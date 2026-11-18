import {
  MIN_ADD_FUND,
  type CategoryKey,
  type OrderItem,
  type PaymentFundRequest,
  type PriceTier,
} from '../data/services';

export type ActivePage = 'home' | 'services' | 'prices' | 'orders' | 'fund' | 'menu' | 'admin';

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

export function formatBalance(balance: number): string {
  const safe = Number.isFinite(balance) ? balance : 0;
  return safe.toFixed(2);
}

export function validateFundAmount(
  raw: string,
): { ok: true; amount: number } | { ok: false; message: string } {
  const amount = parseFloat(raw);
  if (!Number.isFinite(amount) || amount < MIN_ADD_FUND) {
    return { ok: false, message: `Minimum Add Fund ₹${MIN_ADD_FUND} hai` };
  }
  return { ok: true, amount: Math.round(amount * 100) / 100 };
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

export function detectNewPendingPaymentIds(
  knownIds: Set<string>,
  incoming: PaymentFundRequest[],
): string[] {
  return incoming
    .filter((req) => req.status === 'pending' && !knownIds.has(req.id))
    .map((req) => req.id);
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

export interface OrderValidationInput {
  link: string;
  linkPrompt: string;
  category: CategoryKey;
  serviceId?: string;
  selectedPrice: PriceTier | null;
  balance: number;
}

export type OrderValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'missing_link' | 'invalid_link' | 'missing_package' | 'low_balance';
      message: string;
    };

export function validateOrderPlacement(input: OrderValidationInput): OrderValidationResult {
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
  if (input.balance < input.selectedPrice.p) {
    return {
      ok: false,
      reason: 'low_balance',
      message: 'Low Balance ❌ Please Add Funds',
    };
  }
  return { ok: true };
}

export function applyOrderDeduction(balance: number, price: number): number {
  const next = balance - price;
  return Math.max(0, Math.round(next * 100) / 100);
}

export function creditWalletBalance(balance: number, amount: number): number {
  const safeBal = Number.isFinite(balance) ? balance : 0;
  const safeAmt = Number.isFinite(amount) && amount > 0 ? amount : 0;
  return Math.round((safeBal + safeAmt) * 100) / 100;
}

export function createOrderRecord(params: {
  counter: number;
  serviceName: string;
  pack: string;
  price: number;
  link: string;
  uid: string;
  paymentId?: string;
  timestampMs?: number;
  dateStr?: string;
}): OrderItem {
  const ts = params.timestampMs ?? Date.now();
  return {
    id: params.counter,
    order_id: `ORD${ts}`,
    service: params.serviceName,
    pack: params.pack,
    price: params.price,
    amount: params.price,
    link: params.link.trim(),
    status: 'pending',
    date: params.dateStr ?? formatIndianDateTime(ts),
    uid: params.uid,
    ...(params.paymentId ? { paymentId: params.paymentId } : {}),
  };
}

export function getOrderStatusBadgeStyle(status: string): {
  bg: string;
  color: string;
  label: string;
} {
  const normalized = status.toLowerCase();
  if (normalized === 'in progress') {
    return { bg: '#cce5ff', color: '#004085', label: 'IN PROGRESS' };
  }
  if (normalized === 'completed') {
    return { bg: '#d4edda', color: '#155724', label: 'COMPLETED' };
  }
  if (normalized === 'canceled' || normalized === 'cancelled') {
    return { bg: '#f8d7da', color: '#721c24', label: status.toUpperCase() };
  }
  return { bg: '#fff3cd', color: '#856404', label: status.toUpperCase() };
}

export function getPaymentStatusBadgeStyle(status: string): {
  bg: string;
  color: string;
  label: string;
} {
  if (status === 'approved') {
    return { bg: '#d4edda', color: '#155724', label: 'FUND ADDED ✅' };
  }
  if (status === 'wrong_payment') {
    return { bg: '#f8d7da', color: '#721c24', label: 'WRONG PAYMENT ❌' };
  }
  return { bg: '#fff3cd', color: '#856404', label: 'PENDING ⏳' };
}

export function parseHashPage(hash: string): ActivePage {
  const clean = hash.replace(/^#/, '').toLowerCase();
  if (clean === 'orders') return 'orders';
  if (clean === 'fund') return 'fund';
  if (clean === 'menu') return 'menu';
  if (clean === 'admin') return 'admin';
  return 'home';
}
