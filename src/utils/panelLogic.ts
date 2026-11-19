import type {
  CategoryKey,
  CustomerNotification,
  OrderItem,
  PriceTier,
  ServiceItem,
} from '../data/services';

export type ActivePage = 'home' | 'services' | 'prices' | 'orders' | 'menu' | 'admin';

export function formatIndianDateTime(timestampMs: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(timestampMs));
}

export function generateUserId(randomFn: () => number = Math.random): string {
  const num = Math.floor(1000 + randomFn() * 9000);
  return `TRUST-${num}`;
}

export function validatePaymentScreenshot(
  dataUrl: string | null | undefined,
): { ok: true; screenshot: string } | { ok: false; message: string } {
  const trimmed = (dataUrl || '').trim();
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(trimmed);
  if (!match || match[2].length < 40) {
    return { ok: false, message: 'Payment ka screenshot upload karo ❌' };
  }
  return { ok: true, screenshot: trimmed };
}

export function detectNewOrderIds(
  knownIds: Set<string>,
  incoming: OrderItem[],
): string[] {
  return incoming
    .filter((order) => !knownIds.has(order.order_id))
    .map((order) => order.order_id);
}

export interface AdminStatusOverride {
  status: string;
  adminMessage?: string;
  updatedAt: number;
}

export function mergeAdminOrders(params: {
  serverOrders: OrderItem[];
  cachedOrders: OrderItem[];
  deletedIds: Set<string>;
  statusOverrides?: Record<string, AdminStatusOverride>;
}): OrderItem[] {
  const overrides = params.statusOverrides ?? {};
  const byId = new Map<string, OrderItem>();

  const applyOverride = (order: OrderItem): OrderItem => {
    const ov = overrides[order.order_id];
    if (!ov) return order;
    const serverUpdatedAt = typeof order.statusUpdatedAt === 'number' ? order.statusUpdatedAt : 0;
    // Keep Admin's explicit status locked unless server carries a strictly newer explicit admin update
    if (serverUpdatedAt <= ov.updatedAt) {
      return {
        ...order,
        status: ov.status,
        adminMessage: ov.adminMessage ?? order.adminMessage,
        statusUpdatedAt: Math.max(serverUpdatedAt, ov.updatedAt),
      };
    }
    return order;
  };

  for (const order of params.serverOrders) {
    if (!params.deletedIds.has(order.order_id)) {
      byId.set(order.order_id, applyOverride(order));
    }
  }
  for (const cached of params.cachedOrders) {
    if (!params.deletedIds.has(cached.order_id) && !byId.has(cached.order_id)) {
      byId.set(cached.order_id, applyOverride(cached));
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0) || b.id - a.id,
  );
}

export function countUnreadNotifications(notifications: CustomerNotification[]): number {
  return notifications.filter((n) => !n.read).length;
}

export function validatePlatformLink(params: {
  link: string;
  category: CategoryKey;
  serviceId?: string;
}): { ok: true } | { ok: false; message: string } {
  const raw = params.link.trim();
  if (!raw) {
    return { ok: false, message: 'Please enter a valid link' };
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return { ok: false, message: 'Valid URL link enter karo ❌' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  const path = parsed.pathname.replace(/\/+$/, '');
  const hasPath = path.length > 0 && path !== '/';

  if (params.category === 'instagram') {
    if (host !== 'instagram.com' && host !== 'instagr.am') {
      return {
        ok: false,
        message: 'Sirf Instagram ka valid link enter karo (instagram.com) ❌',
      };
    }
    if (!hasPath) {
      return {
        ok: false,
        message: 'Complete Instagram profile, post ya reel link enter karo ❌',
      };
    }
    if (params.serviceId === 'ig-reels-1rs') {
      if (!/^\/(reel|reels)\/[^/]+/i.test(path)) {
        return {
          ok: false,
          message: 'Sirf Instagram Reel link (/reel/...) dalo, Post link allowed nahi hai ❌',
        };
      }
    }
    if (params.serviceId === 'ig-indian-like') {
      if (!/^\/(p|reel|reels|tv)\/[^/]+/i.test(path)) {
        return {
          ok: false,
          message: 'Valid Instagram Post (/p/...) ya Reel (/reel/...) link enter karo ❌',
        };
      }
    }
    return { ok: true };
  }

  if (params.category === 'facebook') {
    const validFbHosts = ['facebook.com', 'fb.com', 'fb.watch', 'l.facebook.com'];
    if (!validFbHosts.includes(host)) {
      return {
        ok: false,
        message: 'Sirf Facebook ka valid link enter karo (facebook.com / fb.com) ❌',
      };
    }
    if (!hasPath && !parsed.searchParams.get('id')) {
      return {
        ok: false,
        message: 'Complete Facebook page, post ya profile link enter karo ❌',
      };
    }
    return { ok: true };
  }

  if (params.category === 'telegram') {
    const validTgHosts = ['t.me', 'telegram.me', 'telegram.dog'];
    if (!validTgHosts.includes(host)) {
      return {
        ok: false,
        message: 'Sirf Telegram ka valid link enter karo (t.me/...) ❌',
      };
    }
    if (!hasPath) {
      return {
        ok: false,
        message: 'Complete Telegram channel ya post link enter karo (t.me/...) ❌',
      };
    }
    if (params.serviceId === 'tg-views' || params.serviceId === 'tg-reactions') {
      if (!/^\/(c\/\d+\/\d+|[^/]+\/\d+)/i.test(path)) {
        return {
          ok: false,
          message: 'Valid Telegram Post link enter karo (e.g. t.me/channel/123) ❌',
        };
      }
    }
    return { ok: true };
  }

  if (params.category === 'youtube') {
    const validYtHosts = ['youtube.com', 'youtu.be', 'music.youtube.com'];
    if (!validYtHosts.includes(host)) {
      return {
        ok: false,
        message: 'Sirf YouTube ka valid link enter karo (youtube.com / youtu.be) ❌',
      };
    }
    const hasWatchV = host !== 'youtu.be' && path === '/watch' && !!parsed.searchParams.get('v');
    const hasValidYtPath = host === 'youtu.be' ? hasPath : hasPath || hasWatchV;
    if (!hasValidYtPath || (path === '/watch' && !parsed.searchParams.get('v'))) {
      return {
        ok: false,
        message: 'Complete YouTube video ya channel link enter karo ❌',
      };
    }
    if (params.serviceId === 'yt-likes' || params.serviceId === 'yt-views') {
      const isVideoUrl =
        host === 'youtu.be' ||
        hasWatchV ||
        /^\/(shorts|live|embed)\/[^/]+/i.test(path);
      if (!isVideoUrl) {
        return {
          ok: false,
          message: 'Valid YouTube Video ya Shorts link enter karo ❌',
        };
      }
    }
    return { ok: true };
  }

  return { ok: true };
}

export interface DirectOrderValidationInput {
  link: string;
  linkPrompt: string;
  category: CategoryKey;
  serviceId?: string;
  selectedPrice: PriceTier | null;
}

export type DirectOrderValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'missing_link' | 'invalid_link' | 'missing_package';
      message: string;
    };

export function validateDirectOrderInput(
  input: DirectOrderValidationInput,
): DirectOrderValidationResult {
  const trimmed = input.link.trim();
  if (!trimmed) {
    return {
      ok: false,
      reason: 'missing_link',
      message: `Please ${input.linkPrompt}`,
    };
  }

  const linkCheck = validatePlatformLink({
    link: trimmed,
    category: input.category,
    serviceId: input.serviceId,
  });
  if (!linkCheck.ok) {
    return {
      ok: false,
      reason: 'invalid_link',
      message: linkCheck.message,
    };
  }

  if (!input.selectedPrice) {
    return {
      ok: false,
      reason: 'missing_package',
      message: 'Select package',
    };
  }

  return { ok: true };
}

export function getOrderStatusBadgeStyle(status: string): {
  bg: string;
  color: string;
  label: string;
} {
  const normalized = status.toLowerCase();
  if (normalized === 'successful' || normalized === 'completed') {
    return { bg: '#d4edda', color: '#155724', label: 'SUCCESSFUL ✅' };
  }
  if (
    normalized === 'payment_failed' ||
    normalized === 'failed' ||
    normalized === 'canceled' ||
    normalized === 'cancelled'
  ) {
    return { bg: '#f8d7da', color: '#721c24', label: 'PAYMENT FAILED ❌' };
  }
  return { bg: '#fff3cd', color: '#856404', label: 'IN PROGRESS ⏳' };
}

export function parseHashPage(hash: string): ActivePage {
  const clean = hash.replace(/^#/, '').toLowerCase();
  if (clean === 'orders') return 'orders';
  if (clean === 'menu') return 'menu';
  if (clean === 'admin') return 'admin';
  return 'home';
}

export interface ServiceCatalogOverrideItem {
  id: string;
  name: string;
  prices: PriceTier[];
}

export function mergeLiveCatalog(
  baseCatalog: Record<CategoryKey, ServiceItem[]>,
  serverCatalog?: Record<string, ServiceCatalogOverrideItem[]> | null,
): Record<CategoryKey, ServiceItem[]> {
  const categories: CategoryKey[] = ['instagram', 'facebook', 'telegram', 'youtube'];
  const result = {} as Record<CategoryKey, ServiceItem[]>;

  for (const cat of categories) {
    const baseList = baseCatalog[cat] || [];
    const overrideList = serverCatalog?.[cat];
    const overrideById = new Map<string, ServiceCatalogOverrideItem>();
    if (Array.isArray(overrideList)) {
      for (const item of overrideList) {
        if (item && typeof item.id === 'string') {
          overrideById.set(item.id, item);
        }
      }
    }

    result[cat] = baseList.map((baseSvc) => {
      const ov = overrideById.get(baseSvc.id);
      if (!ov) {
        return { ...baseSvc, prices: baseSvc.prices.map((p) => ({ ...p })) };
      }
      const cleanPrices = Array.isArray(ov.prices)
        ? ov.prices
            .filter((t) => t && typeof t.q === 'string' && t.q.trim() && Number.isFinite(Number(t.p)) && Number(t.p) >= 1)
            .map((t) => ({ q: t.q.trim(), p: Math.round(Number(t.p) * 100) / 100 }))
        : [];
      return {
        ...baseSvc,
        name: typeof ov.name === 'string' && ov.name.trim() ? ov.name.trim() : baseSvc.name,
        prices: cleanPrices.length > 0 ? cleanPrices : baseSvc.prices.map((p) => ({ ...p })),
      };
    });
  }

  return result;
}

export function validateCatalogServiceEdit(params: {
  name: string;
  prices: Array<{ q: string; p: number }>;
}): { ok: true; name: string; prices: PriceTier[] } | { ok: false; message: string } {
  const name = params.name.trim();
  if (!name) {
    return { ok: false, message: 'Service ka naam khali nahi ho sakta ❌' };
  }
  if (!Array.isArray(params.prices) || params.prices.length === 0) {
    return { ok: false, message: 'Kam se kam 1 package hona chahiye ❌' };
  }
  const cleaned: PriceTier[] = [];
  for (const tier of params.prices) {
    const q = String(tier.q || '').trim();
    const p = Number(tier.p);
    if (!q) {
      return { ok: false, message: 'Har package ka naam enter karo ❌' };
    }
    if (!Number.isFinite(p) || p < 1 || p > 100_000) {
      return { ok: false, message: 'Price ₹1 se ₹1,00,000 ke beech hona chahiye ❌' };
    }
    cleaned.push({ q, p: Math.round(p * 100) / 100 });
  }
  return { ok: true, name, prices: cleaned };
}

export function shouldAdoptServerVersion(params: {
  localUpdatedAt: number;
  serverUpdatedAt: number;
}): boolean {
  const localTs = Number.isFinite(params.localUpdatedAt) ? params.localUpdatedAt : 0;
  const serverTs = Number.isFinite(params.serverUpdatedAt) ? params.serverUpdatedAt : 0;
  // Never let a cold/stale server response overwrite a newer saved Admin edit
  if (localTs > 0 && serverTs < localTs) {
    return false;
  }
  return serverTs >= localTs;
}

export interface CatalogDraftService {
  id: string;
  name: string;
  prices: Array<{ q: string; p: string }>;
}

export function reconcileCatalogDrafts(params: {
  currentDrafts: CatalogDraftService[];
  incomingServices: ServiceItem[];
  dirtyServiceIds: Set<string>;
}): CatalogDraftService[] {
  const currentById = new Map(params.currentDrafts.map((d) => [d.id, d]));
  return params.incomingServices.map((svc) => {
    const existing = currentById.get(svc.id);
    if (existing && params.dirtyServiceIds.has(svc.id)) {
      return existing;
    }
    return {
      id: svc.id,
      name: svc.name,
      prices: svc.prices.map((t) => ({ q: t.q, p: String(t.p) })),
    };
  });
}
