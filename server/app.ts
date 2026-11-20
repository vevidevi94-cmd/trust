import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'banti&1945';
const UPI_ID = process.env.UPI_ID || 'skiend@axl';
const UPI_PAYEE_NAME = process.env.UPI_PAYEE_NAME || 'TrustedPanel';
const FIREBASE_RTDB_URL =
  process.env.FIREBASE_RTDB_URL ||
  'https://trusted-91b2d-default-rtdb.asia-southeast1.firebasedatabase.app';
const FIREBASE_RTDB_AUTH = process.env.FIREBASE_RTDB_AUTH || '';
const KV_REST_API_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_REST_API_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

const SESSION_SECRET = process.env.SESSION_SECRET
  ? crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest()
  : crypto
      .createHash('sha256')
      .update(`${ADMIN_PASS}|tp-hmac-v2|${FIREBASE_RTDB_URL}`)
      .digest();

const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp/trustedpanel_data'
    : path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'trustedpanel_store.json');

const USER_COOKIE = 'tp_uid_sess';
const ADMIN_COOKIE = 'tp_admin_sess';
const USER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year persistent customer memory
const MAX_SCREENSHOT_BYTES = 1_500_000;

interface ServerPriceTier {
  q: string;
  p: number;
}

interface ServerServiceItem {
  id: string;
  name: string;
  prices: ServerPriceTier[];
}

const SERVER_CATALOG: Record<string, ServerServiceItem[]> = {
  instagram: [
    {
      id: 'ig-bluetik',
      name: 'BLUE TIK WITH 500K FOLLOWER',
      prices: [{ q: 'BLUE TIK WITH 500K FOLLOWER', p: 100 }],
    },
    {
      id: 'ig-reels-1rs',
      name: '1rs = 1k Reels Views',
      prices: [
        { q: '1K Reels Views', p: 1 },
        { q: '2K Reels Views', p: 2 },
        { q: '5K Reels Views', p: 5 },
        { q: '10K Reels Views', p: 10 },
      ],
    },
    {
      id: 'ig-indian-follower',
      name: 'INDIAN FOLLOWER 🇮🇳',
      prices: [
        { q: '10K Instagram Followers', p: 30 },
        { q: '20K Instagram Followers', p: 50 },
        { q: '30K Instagram Followers', p: 80 },
        { q: '50K Instagram Followers', p: 100 },
      ],
    },
    {
      id: 'ig-indian-like',
      name: 'INDIAN LIKE 🇮🇳',
      prices: [
        { q: '1K Indian Likes', p: 30 },
        { q: '5K Indian Likes', p: 50 },
        { q: '10K Indian Likes', p: 80 },
        { q: '50K Indian Likes', p: 100 },
      ],
    },
    {
      id: 'ig-story-views',
      name: 'INDIAN STORY VIEWS 🇮🇳',
      prices: [
        { q: '10K Story Views', p: 30 },
        { q: '50K Story Views', p: 50 },
        { q: '100K Story Views', p: 80 },
        { q: '1M Story Views', p: 100 },
      ],
    },
  ],
  facebook: [
    {
      id: 'fb-page-likes',
      name: 'FB PAGE LIKES',
      prices: [
        { q: '1K Page Likes', p: 30 },
        { q: '5K Page Likes', p: 50 },
        { q: '10K Page Likes', p: 80 },
        { q: '50K Page Likes', p: 100 },
      ],
    },
    {
      id: 'fb-post-likes',
      name: 'FB POST LIKES',
      prices: [
        { q: '1K Post Likes', p: 30 },
        { q: '5K Post Likes', p: 50 },
        { q: '10K Post Likes', p: 80 },
        { q: '50K Post Likes', p: 100 },
      ],
    },
    {
      id: 'fb-followers',
      name: 'FB FOLLOWERS',
      prices: [
        { q: '1K Followers', p: 30 },
        { q: '5K Followers', p: 50 },
        { q: '10K Followers', p: 80 },
        { q: '50K Followers', p: 100 },
      ],
    },
  ],
  telegram: [
    {
      id: 'tg-members',
      name: 'Telegram Members',
      prices: [
        { q: '1K Members', p: 30 },
        { q: '5K Members', p: 50 },
        { q: '10K Members', p: 80 },
        { q: '50K Members', p: 100 },
      ],
    },
    {
      id: 'tg-views',
      name: 'Telegram Views',
      prices: [
        { q: '1K Views', p: 30 },
        { q: '10K Views', p: 50 },
        { q: '100K Views', p: 80 },
        { q: '1M Views', p: 100 },
      ],
    },
    {
      id: 'tg-reactions',
      name: 'Telegram Reactions',
      prices: [
        { q: '1K Reactions', p: 30 },
        { q: '5K Reactions', p: 50 },
        { q: '10K Reactions', p: 80 },
        { q: '50K Reactions', p: 100 },
      ],
    },
  ],
  youtube: [
    {
      id: 'yt-subs',
      name: 'YouTube Subscribers',
      prices: [
        { q: '1K Subs', p: 30 },
        { q: '5K Subs', p: 50 },
        { q: '10K Subs', p: 80 },
        { q: '50K Subs', p: 100 },
      ],
    },
    {
      id: 'yt-likes',
      name: 'YouTube Like',
      prices: [
        { q: '1K Likes', p: 30 },
        { q: '5K Likes', p: 50 },
        { q: '10K Likes', p: 80 },
        { q: '50K Likes', p: 100 },
      ],
    },
    {
      id: 'yt-views',
      name: 'YouTube Views',
      prices: [
        { q: '10K Views', p: 30 },
        { q: '50K Views', p: 50 },
        { q: '100K Views', p: 80 },
        { q: '1M Views', p: 100 },
      ],
    },
  ],
};

export interface StoredOrder {
  id: number;
  order_id: string;
  service: string;
  pack: string;
  price: number;
  amount: number;
  link: string;
  status: 'pending' | 'successful' | 'payment_failed';
  adminMessage?: string;
  date: string;
  createdAt: number;
  statusUpdatedAt?: number;
  messageUpdatedAt?: number;
  uid: string;
  app?: string;
  paymentScreenshot: string;
  screenshotHash: string;
  hiddenFromAdmin?: boolean;
}

export interface StoredNotification {
  id: string;
  uid: string;
  orderId: string;
  orderNum: number;
  service: string;
  pack: string;
  status: 'pending' | 'successful' | 'payment_failed';
  message: string;
  date: string;
  createdAt: number;
  read: boolean;
}

interface StoreData {
  knownUsers: Record<string, number>;
  orders: StoredOrder[];
  notifications: StoredNotification[];
  orderCounter: number;
  catalogOverrides?: Record<string, ServerServiceItem[]>;
  catalogUpdatedAt: number;
  posterImage?: string | null;
  posterUpdatedAt: number;
}

function cloneDefaultCatalog(): Record<string, ServerServiceItem[]> {
  return JSON.parse(JSON.stringify(SERVER_CATALOG)) as Record<string, ServerServiceItem[]>;
}

function getLiveCatalog(store: StoreData): Record<string, ServerServiceItem[]> {
  const base = cloneDefaultCatalog();
  if (!store.catalogOverrides || typeof store.catalogOverrides !== 'object') {
    return base;
  }
  for (const catKey of Object.keys(base)) {
    const customList = store.catalogOverrides[catKey];
    if (!Array.isArray(customList) || customList.length === 0) continue;
    const customById = new Map<string, ServerServiceItem>();
    for (const svc of customList) {
      if (svc && typeof svc.id === 'string' && typeof svc.name === 'string' && Array.isArray(svc.prices) && svc.prices.length > 0) {
        customById.set(svc.id, svc);
      }
    }
    base[catKey] = base[catKey].map((defSvc) => {
      const custom = customById.get(defSvc.id);
      if (!custom) return defSvc;
      return {
        id: defSvc.id,
        name: custom.name.trim() || defSvc.name,
        prices: custom.prices
          .filter((tier) => tier && typeof tier.q === 'string' && tier.q.trim() && Number.isFinite(Number(tier.p)) && Number(tier.p) >= 1)
          .map((tier) => ({ q: tier.q.trim(), p: Math.round(Number(tier.p) * 100) / 100 })),
      };
    }).map((svc) => (svc.prices.length > 0 ? svc : base[catKey].find((d) => d.id === svc.id) || svc));
  }
  return base;
}

function formatIndianDateTime(timestampMs: number): string {
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

function validateOrderLinkOnServer(params: {
  link: string;
  category?: string;
  serviceId?: string;
  serviceName?: string;
}): { ok: true } | { ok: false; message: string } {
  const raw = String(params.link || '').trim();
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
  const pathname = parsed.pathname.replace(/\/+$/, '');
  const hasPath = pathname.length > 0 && pathname !== '/';

  const svcLower = String(params.serviceName || '').toLowerCase();
  const inferredCategory =
    params.category ||
    (svcLower.startsWith('fb ')
      ? 'facebook'
      : svcLower.startsWith('telegram')
        ? 'telegram'
        : svcLower.startsWith('youtube')
          ? 'youtube'
          : svcLower.includes('reel') ||
              svcLower.includes('indian') ||
              svcLower.includes('blue tik')
            ? 'instagram'
            : undefined);

  if (inferredCategory === 'instagram') {
    if (host !== 'instagram.com' && host !== 'instagr.am') {
      return { ok: false, message: 'Sirf Instagram ka valid link enter karo (instagram.com) ❌' };
    }
    if (!hasPath) {
      return { ok: false, message: 'Complete Instagram profile, post ya reel link enter karo ❌' };
    }
    if (params.serviceId === 'ig-reels-1rs' || svcLower.includes('reels views')) {
      if (!/^\/(reel|reels)\/[^/]+/i.test(pathname)) {
        return {
          ok: false,
          message: 'Sirf Instagram Reel link (/reel/...) dalo, Post link allowed nahi hai ❌',
        };
      }
    }
    if (params.serviceId === 'ig-indian-like' || svcLower.includes('indian like')) {
      if (!/^\/(p|reel|reels|tv)\/[^/]+/i.test(pathname)) {
        return {
          ok: false,
          message: 'Valid Instagram Post (/p/...) ya Reel (/reel/...) link enter karo ❌',
        };
      }
    }
    return { ok: true };
  }

  if (inferredCategory === 'facebook') {
    if (!['facebook.com', 'fb.com', 'fb.watch', 'l.facebook.com'].includes(host)) {
      return {
        ok: false,
        message: 'Sirf Facebook ka valid link enter karo (facebook.com / fb.com) ❌',
      };
    }
    if (!hasPath && !parsed.searchParams.get('id')) {
      return { ok: false, message: 'Complete Facebook page, post ya profile link enter karo ❌' };
    }
    return { ok: true };
  }

  if (inferredCategory === 'telegram') {
    if (!['t.me', 'telegram.me', 'telegram.dog'].includes(host)) {
      return { ok: false, message: 'Sirf Telegram ka valid link enter karo (t.me/...) ❌' };
    }
    if (!hasPath) {
      return { ok: false, message: 'Complete Telegram channel ya post link enter karo (t.me/...) ❌' };
    }
    if (
      params.serviceId === 'tg-views' ||
      params.serviceId === 'tg-reactions' ||
      svcLower.includes('telegram views') ||
      svcLower.includes('telegram reactions')
    ) {
      if (!/^\/(c\/\d+\/\d+|[^/]+\/\d+)/i.test(pathname)) {
        return { ok: false, message: 'Valid Telegram Post link enter karo (e.g. t.me/channel/123) ❌' };
      }
    }
    return { ok: true };
  }

  if (inferredCategory === 'youtube') {
    if (!['youtube.com', 'youtu.be', 'music.youtube.com'].includes(host)) {
      return { ok: false, message: 'Sirf YouTube ka valid link enter karo (youtube.com / youtu.be) ❌' };
    }
    const hasWatchV = host !== 'youtu.be' && pathname === '/watch' && !!parsed.searchParams.get('v');
    const hasValidYtPath = host === 'youtu.be' ? hasPath : hasPath || hasWatchV;
    if (!hasValidYtPath || (pathname === '/watch' && !parsed.searchParams.get('v'))) {
      return { ok: false, message: 'Complete YouTube video ya channel link enter karo ❌' };
    }
    if (
      params.serviceId === 'yt-likes' ||
      params.serviceId === 'yt-views' ||
      svcLower.includes('youtube like') ||
      svcLower.includes('youtube views')
    ) {
      const isVideoUrl =
        host === 'youtu.be' || hasWatchV || /^\/(shorts|live|embed)\/[^/]+/i.test(pathname);
      if (!isVideoUrl) {
        return { ok: false, message: 'Valid YouTube Video ya Shorts link enter karo ❌' };
      }
    }
    return { ok: true };
  }

  return { ok: true };
}

function loadStore(): StoreData {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
      const orders = Array.isArray(parsed.orders) ? parsed.orders : [];
      const notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
      const maxId = orders.reduce(
        (m: number, o: { id?: number }) => (typeof o.id === 'number' && o.id > m ? o.id : m),
        0,
      );
      return {
        knownUsers: parsed.knownUsers && typeof parsed.knownUsers === 'object' ? parsed.knownUsers : {},
        orders,
        notifications,
        orderCounter:
          typeof parsed.orderCounter === 'number' && parsed.orderCounter > maxId
            ? parsed.orderCounter
            : maxId + 1,
        catalogOverrides:
          parsed.catalogOverrides && typeof parsed.catalogOverrides === 'object'
            ? parsed.catalogOverrides
            : undefined,
        catalogUpdatedAt:
          typeof parsed.catalogUpdatedAt === 'number' ? parsed.catalogUpdatedAt : 0,
        posterImage: typeof parsed.posterImage === 'string' ? parsed.posterImage : null,
        posterUpdatedAt:
          typeof parsed.posterUpdatedAt === 'number' ? parsed.posterUpdatedAt : 0,
      };
    }
  } catch {
    // Fallback to clean store
  }
  return {
    knownUsers: {},
    orders: [],
    notifications: [],
    orderCounter: 1,
    catalogUpdatedAt: 0,
    posterImage: null,
    posterUpdatedAt: 0,
  };
}

function saveStore(store: StoreData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // Ignore disk write errors in read-only environments
  }
}

function buildFirebaseUrl(subPath: string): string {
  const base = `${FIREBASE_RTDB_URL}/${subPath}.json`;
  return FIREBASE_RTDB_AUTH ? `${base}?auth=${encodeURIComponent(FIREBASE_RTDB_AUTH)}` : base;
}

let firebaseBlockedUntilMs = 0;

async function syncToFirebase(subPath: string, payload: unknown): Promise<void> {
  if (Date.now() < firebaseBlockedUntilMs) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(buildFirebaseUrl(subPath), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 401 || res.status === 403) {
      firebaseBlockedUntilMs = Date.now() + 60_000;
    }
  } catch {
    // Firebase RTDB rules may reject unauthenticated REST writes
  }
}

async function readFromFirebase<T>(subPath: string): Promise<T | null> {
  if (Date.now() < firebaseBlockedUntilMs) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(buildFirebaseUrl(subPath), {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 401 || res.status === 403) {
      firebaseBlockedUntilMs = Date.now() + 60_000;
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function writeToKv(key: string, payload: unknown): Promise<void> {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    await fetch(`${KV_REST_API_URL.replace(/\/+$/, '')}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // Ignore transient KV errors
  }
}

async function readFromKv<T>(key: string): Promise<T | null> {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(`${KV_REST_API_URL.replace(/\/+$/, '')}/get/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: unknown };
    if (!body || body.result == null) return null;
    if (typeof body.result === 'string') {
      return JSON.parse(body.result) as T;
    }
    return body.result as T;
  } catch {
    return null;
  }
}

function signToken(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken<T extends Record<string, unknown>>(token: string | undefined): T | null {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
    if (typeof decoded.exp === 'number' && Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || proto === 'https';
}

function setSessionCookie(
  res: Response,
  req: Request,
  name: string,
  value: string,
  maxAgeSec: number,
): void {
  const isHttps = isHttpsRequest(req);
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSec}`,
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res: Response, req: Request, name: string): void {
  const isHttps = isHttpsRequest(req);
  const parts = [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

function safeComparePassword(input: string, secret: string): boolean {
  const a = Buffer.from(input, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function resolveQrImagePath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'server/assets/payment_qr.jpg'),
    path.resolve(__dirname, 'assets/payment_qr.jpg'),
    path.resolve(__dirname, '../server/assets/payment_qr.jpg'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function getVerifiedUserSession(req: Request): { uid: string; sid: string; token: string } | null {
  const cookies = parseCookies(req);
  const cookieToken = cookies[USER_COOKIE];
  const headerToken = typeof req.headers['x-user-token'] === 'string' ? req.headers['x-user-token'] : '';
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : '';

  for (const candidate of [cookieToken, headerToken, queryToken]) {
    if (!candidate) continue;
    const verified = verifyToken<{ uid?: string; sid?: string }>(candidate);
    if (verified?.uid && verified?.sid && /^TRUST-\d{4}$/.test(verified.uid)) {
      return { uid: verified.uid, sid: verified.sid, token: candidate };
    }
  }
  return null;
}

function getOrIssueUserSession(
  req: Request,
  res: Response,
  store: StoreData,
): { uid: string; sid: string; token: string } {
  const existing = getVerifiedUserSession(req);
  if (existing) {
    // Re-sync cookie if client restored identity from persistent backup header
    const cookies = parseCookies(req);
    if (!cookies[USER_COOKIE]) {
      setSessionCookie(res, req, USER_COOKIE, existing.token, USER_SESSION_MAX_AGE_SEC);
    }
    return existing;
  }

  let uid = '';
  for (let i = 0; i < 16; i++) {
    const num = crypto.randomInt(1000, 10000);
    const candidate = `TRUST-${num}`;
    if (!(candidate in store.knownUsers)) {
      uid = candidate;
      break;
    }
  }
  if (!uid) {
    uid = `TRUST-${crypto.randomInt(1000, 10000)}`;
  }

  store.knownUsers[uid] = Date.now();
  saveStore(store);

  const sid = crypto.randomBytes(16).toString('hex');
  const token = signToken({
    uid,
    sid,
    iat: Date.now(),
    exp: Date.now() + USER_SESSION_MAX_AGE_SEC * 1000,
  });
  setSessionCookie(res, req, USER_COOKIE, token, USER_SESSION_MAX_AGE_SEC);
  return { uid, sid, token };
}

function isAdminAuthenticated(req: Request): boolean {
  const cookies = parseCookies(req);
  const verified = verifyToken<{ role?: string }>(cookies[ADMIN_COOKIE]);
  return verified?.role === 'admin';
}

function sanitizeScreenshotDataUrl(
  raw: unknown,
): { ok: true; dataUrl: string; hash: string } | { ok: false; message: string } {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'Payment screenshot upload karo ❌' };
  }
  const trimmed = raw.trim();
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(trimmed);
  if (!match) {
    return { ok: false, message: 'Valid image screenshot (PNG/JPG/WEBP) upload karo ❌' };
  }
  const base64Data = match[2];
  const byteLength = Math.floor((base64Data.length * 3) / 4);
  if (byteLength < 200) {
    return { ok: false, message: 'Screenshot image invalid ya khali hai ❌' };
  }
  if (byteLength > MAX_SCREENSHOT_BYTES) {
    return { ok: false, message: 'Screenshot size bahut bada hai (Max 1.5MB) ❌' };
  }
  const hash = crypto.createHash('sha256').update(base64Data).digest('hex');
  return { ok: true, dataUrl: trimmed, hash };
}

export function createApiApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2.5mb' }));

  // Global security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-XSS-Protection', '0');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
    next();
  });

  const store = loadStore();
  const usedQrTokens = new Map<string, number>();
  const loginFailures = new Map<string, { count: number; resetAt: number }>();
  const adminSseClients = new Set<Response>();
  const userSseClients = new Map<string, Set<Response>>();

  function sendSse(res: Response, event: string, data: unknown): void {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Ignore write failures on closing sockets
    }
  }

  function broadcastToAdmins(event: string, data: unknown): void {
    for (const client of adminSseClients) {
      sendSse(client, event, data);
    }
  }

  function broadcastToUser(uid: string, event: string, data: unknown): void {
    const clients = userSseClients.get(uid);
    if (!clients) return;
    for (const client of clients) {
      sendSse(client, event, data);
    }
  }

  function broadcastToAllUsers(event: string, data: unknown): void {
    for (const clients of userSseClients.values()) {
      for (const client of clients) {
        sendSse(client, event, data);
      }
    }
  }

  // Hydrate cold serverless instance from server-signed HMAC catalog proof header if newer
  function hydrateCatalogFromSignedHeader(req: Request): void {
    const token =
      typeof req.headers['x-catalog-token'] === 'string' ? req.headers['x-catalog-token'] : '';
    if (!token) return;
    const verified = verifyToken<{
      catalog?: Record<string, ServerServiceItem[]> | null;
      updatedAt?: number;
    }>(token);
    if (!verified || typeof verified.updatedAt !== 'number') return;
    if (verified.updatedAt > store.catalogUpdatedAt) {
      store.catalogOverrides =
        verified.catalog && typeof verified.catalog === 'object' ? verified.catalog : undefined;
      store.catalogUpdatedAt = verified.updatedAt;
      saveStore(store);
    }
  }

  let lastRemoteConfigSyncMs = 0;
  async function syncConfigFromFirebaseIfStale(): Promise<void> {
    const now = Date.now();
    if (now - lastRemoteConfigSyncMs < 1500) return;
    lastRemoteConfigSyncMs = now;

    const [kvCatalog, kvPoster, fbCatalog, fbPoster] = await Promise.all([
      readFromKv<{ catalog?: Record<string, ServerServiceItem[]> | null; catalogUpdatedAt?: number }>(
        'tp:config:catalog',
      ),
      readFromKv<{ posterImage?: string | null; posterUpdatedAt?: number }>('tp:config:poster'),
      readFromFirebase<{ catalog?: Record<string, ServerServiceItem[]> | null; catalogUpdatedAt?: number }>(
        'config/catalog',
      ),
      readFromFirebase<{ posterImage?: string | null; posterUpdatedAt?: number }>('config/poster'),
    ]);

    let changed = false;
    for (const remoteCat of [kvCatalog, fbCatalog]) {
      if (
        remoteCat &&
        typeof remoteCat.catalogUpdatedAt === 'number' &&
        remoteCat.catalogUpdatedAt > store.catalogUpdatedAt
      ) {
        store.catalogOverrides =
          remoteCat.catalog && typeof remoteCat.catalog === 'object'
            ? remoteCat.catalog
            : undefined;
        store.catalogUpdatedAt = remoteCat.catalogUpdatedAt;
        changed = true;
      }
    }

    for (const remotePoster of [kvPoster, fbPoster]) {
      if (
        remotePoster &&
        typeof remotePoster.posterUpdatedAt === 'number' &&
        remotePoster.posterUpdatedAt > store.posterUpdatedAt
      ) {
        store.posterImage =
          typeof remotePoster.posterImage === 'string' ? remotePoster.posterImage : null;
        store.posterUpdatedAt = remotePoster.posterUpdatedAt;
        changed = true;
      }
    }

    if (changed) saveStore(store);
  }

  async function persistCatalogRemote(): Promise<void> {
    const payload = {
      catalog: store.catalogOverrides ?? null,
      catalogUpdatedAt: store.catalogUpdatedAt,
    };
    await Promise.all([
      writeToKv('tp:config:catalog', payload),
      syncToFirebase('config/catalog', payload),
    ]);
  }

  async function persistPosterRemote(): Promise<void> {
    const payload = {
      posterImage: store.posterImage ?? null,
      posterUpdatedAt: store.posterUpdatedAt,
    };
    await Promise.all([
      writeToKv('tp:config:poster', payload),
      syncToFirebase('config/poster', payload),
    ]);
  }

  function toAdminOrderDto(o: StoredOrder) {
    return {
      id: o.id,
      order_id: o.order_id,
      service: o.service,
      pack: o.pack,
      price: o.price,
      amount: o.amount,
      link: o.link,
      status: o.status,
      adminMessage: o.adminMessage,
      date: o.date,
      createdAt: o.createdAt,
      statusUpdatedAt: o.statusUpdatedAt,
      messageUpdatedAt: o.messageUpdatedAt,
      uid: o.uid,
      app: o.app,
      hasPaymentScreenshot: Boolean(o.paymentScreenshot),
      screenshotUrl: o.paymentScreenshot
        ? `/api/admin/orders/${encodeURIComponent(o.order_id)}/screenshot`
        : undefined,
    };
  }

  function toCustomerOrderDto(o: StoredOrder) {
    return {
      id: o.id,
      order_id: o.order_id,
      service: o.service,
      pack: o.pack,
      price: o.price,
      amount: o.amount,
      link: o.link,
      status: o.status,
      adminMessage: o.adminMessage,
      date: o.date,
      createdAt: o.createdAt,
      statusUpdatedAt: o.statusUpdatedAt,
      messageUpdatedAt: o.messageUpdatedAt,
      uid: o.uid,
      app: o.app,
      hasPaymentScreenshot: Boolean(o.paymentScreenshot),
    };
  }

  function mergeRemoteOrder(remote: Partial<StoredOrder>): boolean {
    if (!remote || typeof remote.order_id !== 'string' || !remote.order_id) return false;
    const existing = store.orders.find((o) => o.order_id === remote.order_id);
    if (!existing) {
      const orderNum =
        typeof remote.id === 'number' && Number.isFinite(remote.id)
          ? remote.id
          : store.orderCounter++;
      if (orderNum >= store.orderCounter) {
        store.orderCounter = orderNum + 1;
      }
      store.orders.push({
        id: orderNum,
        order_id: remote.order_id,
        service: String(remote.service || 'Order'),
        pack: String(remote.pack || ''),
        price: Number(remote.price) || 0,
        amount: Number(remote.amount ?? remote.price) || 0,
        link: String(remote.link || ''),
        status:
          remote.status === 'successful' || remote.status === 'payment_failed'
            ? remote.status
            : 'pending',
        adminMessage: typeof remote.adminMessage === 'string' ? remote.adminMessage : undefined,
        date: String(remote.date || formatIndianDateTime(Number(remote.createdAt) || Date.now())),
        createdAt: Number(remote.createdAt) || Date.now(),
        statusUpdatedAt:
          typeof remote.statusUpdatedAt === 'number' ? remote.statusUpdatedAt : undefined,
        messageUpdatedAt:
          typeof remote.messageUpdatedAt === 'number' ? remote.messageUpdatedAt : undefined,
        uid: String(remote.uid || 'TRUST-0000'),
        app: typeof remote.app === 'string' ? remote.app : 'UPI',
        paymentScreenshot:
          typeof remote.paymentScreenshot === 'string' ? remote.paymentScreenshot : '',
        screenshotHash: typeof remote.screenshotHash === 'string' ? remote.screenshotHash : '',
        hiddenFromAdmin: Boolean(remote.hiddenFromAdmin),
      });
      return true;
    }

    let changed = false;
    const remStatusTs = typeof remote.statusUpdatedAt === 'number' ? remote.statusUpdatedAt : 0;
    const curStatusTs = typeof existing.statusUpdatedAt === 'number' ? existing.statusUpdatedAt : 0;
    if (
      remStatusTs > curStatusTs &&
      (remote.status === 'pending' ||
        remote.status === 'successful' ||
        remote.status === 'payment_failed')
    ) {
      existing.status = remote.status;
      existing.statusUpdatedAt = remStatusTs;
      changed = true;
    }

    const remMsgTs = typeof remote.messageUpdatedAt === 'number' ? remote.messageUpdatedAt : remStatusTs;
    const curMsgTs = typeof existing.messageUpdatedAt === 'number' ? existing.messageUpdatedAt : curStatusTs;
    if (remMsgTs > curMsgTs && typeof remote.adminMessage === 'string') {
      existing.adminMessage = remote.adminMessage;
      existing.messageUpdatedAt = remMsgTs;
      changed = true;
    }

    if (remote.hiddenFromAdmin && !existing.hiddenFromAdmin) {
      existing.hiddenFromAdmin = true;
      changed = true;
    }
    return changed;
  }

  function mergeRemoteNotification(remote: Partial<StoredNotification>): boolean {
    if (!remote || typeof remote.id !== 'string' || !remote.id || typeof remote.uid !== 'string') {
      return false;
    }
    const existing = store.notifications.find((n) => n.id === remote.id);
    if (!existing) {
      store.notifications.push({
        id: remote.id,
        uid: remote.uid,
        orderId: String(remote.orderId || ''),
        orderNum: Number(remote.orderNum) || 0,
        service: String(remote.service || ''),
        pack: String(remote.pack || ''),
        status:
          remote.status === 'successful' || remote.status === 'payment_failed'
            ? remote.status
            : 'pending',
        message: String(remote.message || ''),
        date: String(remote.date || formatIndianDateTime(Number(remote.createdAt) || Date.now())),
        createdAt: Number(remote.createdAt) || Date.now(),
        read: Boolean(remote.read),
      });
      return true;
    }
    if (remote.read && !existing.read) {
      existing.read = true;
      return true;
    }
    return false;
  }

  let lastRemoteOrdersSyncMs = 0;
  async function syncOrdersFromRemoteIfStale(): Promise<void> {
    const hasKv = Boolean(KV_REST_API_URL && KV_REST_API_TOKEN);
    const hasFb = Date.now() >= firebaseBlockedUntilMs;
    if (!hasKv && !hasFb) return;
    const now = Date.now();
    if (now - lastRemoteOrdersSyncMs < 1000) return;
    lastRemoteOrdersSyncMs = now;

    const [kvOrders, kvNotifs, fbOrders, fbNotifs] = await Promise.all([
      hasKv ? readFromKv<StoredOrder[]>('tp:orders:list') : Promise.resolve(null),
      hasKv ? readFromKv<StoredNotification[]>('tp:notifs:list') : Promise.resolve(null),
      hasFb ? readFromFirebase<Record<string, Partial<StoredOrder>>>('orders') : Promise.resolve(null),
      hasFb
        ? readFromFirebase<Record<string, Record<string, Partial<StoredNotification>>>>('notifications')
        : Promise.resolve(null),
    ]);

    let changed = false;
    if (Array.isArray(kvOrders)) {
      for (const o of kvOrders) {
        if (mergeRemoteOrder(o)) changed = true;
      }
    }
    if (fbOrders && typeof fbOrders === 'object') {
      for (const o of Object.values(fbOrders)) {
        if (mergeRemoteOrder(o)) changed = true;
      }
    }
    if (Array.isArray(kvNotifs)) {
      for (const n of kvNotifs) {
        if (mergeRemoteNotification(n)) changed = true;
      }
    }
    if (fbNotifs && typeof fbNotifs === 'object') {
      for (const byUser of Object.values(fbNotifs)) {
        if (!byUser || typeof byUser !== 'object') continue;
        for (const n of Object.values(byUser)) {
          if (mergeRemoteNotification(n)) changed = true;
        }
      }
    }

    if (changed) {
      store.orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || b.id - a.id);
      store.notifications.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      saveStore(store);
    }
  }

  async function persistOrderAndNotifRemote(
    order: StoredOrder,
    notif?: StoredNotification,
  ): Promise<void> {
    const tasks: Promise<void>[] = [];
    const lightOrderForRemote = {
      id: order.id,
      order_id: order.order_id,
      service: order.service,
      pack: order.pack,
      price: order.price,
      amount: order.amount,
      link: order.link,
      status: order.status,
      adminMessage: order.adminMessage,
      date: order.date,
      createdAt: order.createdAt,
      statusUpdatedAt: order.statusUpdatedAt,
      messageUpdatedAt: order.messageUpdatedAt,
      uid: order.uid,
      app: order.app,
      hiddenFromAdmin: order.hiddenFromAdmin,
    };
    tasks.push(syncToFirebase(`orders/${order.order_id}`, lightOrderForRemote));
    if (notif) {
      tasks.push(syncToFirebase(`notifications/${notif.uid}/${notif.id}`, notif));
    }
    if (KV_REST_API_URL && KV_REST_API_TOKEN) {
      tasks.push(
        writeToKv(
          'tp:orders:list',
          store.orders.slice(0, 120).map((o) => ({
            ...o,
            paymentScreenshot: o.paymentScreenshot ? '' : '',
          })),
        ),
      );
      if (notif) {
        tasks.push(writeToKv('tp:notifs:list', store.notifications.slice(0, 200)));
      }
    }
    await Promise.all(tasks);
  }

  function makeCatalogToken(): string | null {
    if (!store.catalogUpdatedAt) return null;
    return signToken({
      catalog: store.catalogOverrides ?? null,
      updatedAt: store.catalogUpdatedAt,
    });
  }

  // Public live catalog & poster endpoint (reflects Admin edits immediately)
  app.get('/api/catalog', async (req, res) => {
    hydrateCatalogFromSignedHeader(req);
    await syncConfigFromFirebaseIfStale();
    res.json({
      ok: true,
      catalog: getLiveCatalog(store),
      catalogUpdatedAt: store.catalogUpdatedAt,
      catalogToken: makeCatalogToken(),
      posterImage: store.posterImage || null,
      posterUpdatedAt: store.posterUpdatedAt,
    });
  });

  function pruneTokens() {
    const now = Date.now();
    for (const [jti, exp] of usedQrTokens.entries()) {
      if (exp < now) usedQrTokens.delete(jti);
    }
    for (const [ip, rec] of loginFailures.entries()) {
      if (rec.resetAt < now) loginFailures.delete(ip);
    }
  }

  // Real-time Server-Sent Events stream for Customer Bell notifications
  app.get('/api/user/events', (req, res) => {
    const session = getVerifiedUserSession(req);
    if (!session) {
      res.status(401).end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let clients = userSseClients.get(session.uid);
    if (!clients) {
      clients = new Set<Response>();
      userSseClients.set(session.uid, clients);
    }
    clients.add(res);
    sendSse(res, 'connected', { ok: true, uid: session.uid });

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 20_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      clients?.delete(res);
      if (clients && clients.size === 0) {
        userSseClients.delete(session.uid);
      }
    });
  });

  // Real-time Server-Sent Events stream for Admin live orders
  app.get('/api/admin/events', (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    adminSseClients.add(res);
    sendSse(res, 'connected', { ok: true });

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 20_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      adminSseClients.delete(res);
    });
  });

  // Customer's own persistent state (orders + live notifications from admin)
  app.get('/api/user-state', async (req, res) => {
    await syncOrdersFromRemoteIfStale();
    const session = getOrIssueUserSession(req, res, store);

    const orders = store.orders
      .filter((o) => o.uid === session.uid)
      .map(toCustomerOrderDto);

    const notifications = store.notifications
      .filter((n) => n.uid === session.uid)
      .slice(0, 50);

    res.json({
      ok: true,
      uid: session.uid,
      sessionToken: session.token,
      orders,
      notifications,
    });
  });

  // Mark all customer notifications as read when Bell modal is opened
  app.post('/api/notifications/read', (req, res) => {
    const session = getVerifiedUserSession(req);
    if (!session) {
      res.json({ ok: true });
      return;
    }
    let changed = false;
    for (const n of store.notifications) {
      if (n.uid === session.uid && !n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) saveStore(store);
    res.json({ ok: true });
  });

  // Validate service + link & issue single-use QR token for direct order payment
  app.post('/api/order/checkout', async (req, res) => {
    pruneTokens();
    hydrateCatalogFromSignedHeader(req);
    await syncConfigFromFirebaseIfStale();
    const session = getOrIssueUserSession(req, res, store);
    const category = String(req.body?.category || '').trim();
    const serviceId = String(req.body?.serviceId || '').trim();
    const packIndex = Number(req.body?.packIndex);
    const link = String(req.body?.link || '').trim();

    const liveCatalog = getLiveCatalog(store);
    const catServices = liveCatalog[category];
    const service = catServices?.find((s) => s.id === serviceId);
    if (!service || !Number.isInteger(packIndex) || packIndex < 0 || packIndex >= service.prices.length) {
      res.status(400).json({ ok: false, message: 'Invalid service or package selected ❌' });
      return;
    }

    const linkCheck = validateOrderLinkOnServer({
      link,
      category,
      serviceId: service.id,
      serviceName: service.name,
    });
    if (!linkCheck.ok) {
      res.status(400).json({ ok: false, reason: 'invalid_link', message: linkCheck.message });
      return;
    }

    const packTier = service.prices[packIndex];
    const jti = crypto.randomBytes(12).toString('hex');
    const qrToken = signToken({
      uid: session.uid,
      sid: session.sid,
      amt: packTier.p,
      jti,
      exp: Date.now() + 300_000,
    });

    res.json({
      ok: true,
      amount: packTier.p,
      serviceName: service.name,
      pack: packTier.q,
      qrToken,
    });
  });

  // Serve dynamic UPI QR image with exact live amount encoded inside (UPI ID never leaves server)
  app.get('/api/order/qr', async (req, res) => {
    pruneTokens();
    const session = getVerifiedUserSession(req);
    if (!session) {
      res.status(403).send('Forbidden');
      return;
    }
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const decoded = verifyToken<{ uid?: string; sid?: string; amt?: number; jti?: string; exp?: number }>(token);
    if (
      !decoded ||
      decoded.uid !== session.uid ||
      decoded.sid !== session.sid ||
      !decoded.jti ||
      usedQrTokens.has(decoded.jti)
    ) {
      res.status(403).send('Forbidden');
      return;
    }

    usedQrTokens.set(decoded.jti, typeof decoded.exp === 'number' ? decoded.exp : Date.now() + 300_000);

    const amountNum = typeof decoded.amt === 'number' && Number.isFinite(decoded.amt) && decoded.amt > 0 ? decoded.amt : 1;
    const amountParam = Number.isInteger(amountNum) ? String(amountNum) : amountNum.toFixed(2);
    const upiUri = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_PAYEE_NAME)}&am=${encodeURIComponent(amountParam)}&cu=INR`;

    try {
      const pngBuffer = await QRCode.toBuffer(upiUri, {
        type: 'png',
        width: 480,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Content-Disposition', 'inline');
      res.send(pngBuffer);
      return;
    } catch {
      const qrPath = resolveQrImagePath();
      if (!qrPath) {
        res.status(404).send('Not found');
        return;
      }
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Content-Disposition', 'inline');
      fs.createReadStream(qrPath).pipe(res);
    }
  });

  // Direct order placement with payment screenshot (uses live Admin-configured prices)
  app.post('/api/orders', async (req, res) => {
    hydrateCatalogFromSignedHeader(req);
    await syncConfigFromFirebaseIfStale();
    const session = getOrIssueUserSession(req, res, store);
    const category = String(req.body?.category || '').trim();
    const serviceId = String(req.body?.serviceId || '').trim();
    const packIndex = Number(req.body?.packIndex);
    const link = String(req.body?.link || '').trim();
    const appName = String(req.body?.app || 'UPI').trim().slice(0, 30);

    const liveCatalog = getLiveCatalog(store);
    const catServices = liveCatalog[category];
    const service = catServices?.find((s) => s.id === serviceId);
    if (!service || !Number.isInteger(packIndex) || packIndex < 0 || packIndex >= service.prices.length) {
      res.status(400).json({ ok: false, message: 'Invalid service or package selected ❌' });
      return;
    }

    const linkCheck = validateOrderLinkOnServer({
      link,
      category,
      serviceId: service.id,
      serviceName: service.name,
    });
    if (!linkCheck.ok) {
      res.status(400).json({ ok: false, reason: 'invalid_link', message: linkCheck.message });
      return;
    }

    const imgCheck = sanitizeScreenshotDataUrl(req.body?.screenshot);
    if (!imgCheck.ok) {
      res.status(400).json({ ok: false, reason: 'invalid_screenshot', message: imgCheck.message });
      return;
    }

    // Prevent reusing the exact same payment screenshot on multiple non-failed orders
    const duplicate = store.orders.find(
      (o) => o.screenshotHash === imgCheck.hash && o.status !== 'payment_failed',
    );
    if (duplicate) {
      res.status(400).json({
        ok: false,
        reason: 'duplicate_screenshot',
        message: 'Yeh payment screenshot pehle hi use ho chuka hai ❌',
      });
      return;
    }

    const packTier = service.prices[packIndex];
    const now = Date.now();
    const orderNum = store.orderCounter++;
    const savedOrder: StoredOrder = {
      id: orderNum,
      order_id: `ORD${now}_${crypto.randomInt(10, 99)}`,
      service: service.name,
      pack: packTier.q,
      price: packTier.p,
      amount: packTier.p,
      link,
      status: 'pending',
      date: formatIndianDateTime(now),
      createdAt: now,
      uid: session.uid,
      app: appName,
      paymentScreenshot: imgCheck.dataUrl,
      screenshotHash: imgCheck.hash,
      hiddenFromAdmin: false,
    };

    store.orders.unshift(savedOrder);
    saveStore(store);
    const adminDto = toAdminOrderDto(savedOrder);
    const customerDto = toCustomerOrderDto(savedOrder);
    broadcastToAdmins('new_order', {
      order: adminDto,
      order_id: savedOrder.order_id,
      id: savedOrder.id,
      service: savedOrder.service,
      price: savedOrder.price,
    });
    await persistOrderAndNotifRemote(savedOrder);

    res.json({
      ok: true,
      order: customerDto,
    });
  });

  // Admin session check
  app.get('/api/admin/session', (req, res) => {
    res.json({ ok: true, authenticated: isAdminAuthenticated(req) });
  });

  // Admin login (timing-safe + HttpOnly cookie + brute-force limit)
  app.post('/api/admin/login', (req, res) => {
    pruneTokens();
    const ip = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
    const failInfo = loginFailures.get(ip);
    if (failInfo && failInfo.count >= 5 && failInfo.resetAt > Date.now()) {
      res.status(429).json({ ok: false, message: 'Too many wrong attempts. Wait 5 mins ❌' });
      return;
    }

    const password = String(req.body?.password || '');
    if (!safeComparePassword(password, ADMIN_PASS)) {
      const nextCount = (failInfo?.count ?? 0) + 1;
      loginFailures.set(ip, { count: nextCount, resetAt: Date.now() + 5 * 60_000 });
      res.status(401).json({ ok: false, message: 'Wrong Password ❌' });
      return;
    }

    loginFailures.delete(ip);
    const adminToken = signToken({
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 12,
    });
    setSessionCookie(res, req, ADMIN_COOKIE, adminToken, 60 * 60 * 12);
    res.json({ ok: true });
  });

  app.post('/api/admin/logout', (req, res) => {
    clearSessionCookie(res, req, ADMIN_COOKIE);
    res.json({ ok: true });
  });

  // Live Admin orders list — lightweight payload (screenshots served separately & cached)
  app.get('/api/admin/overview', async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }
    await syncOrdersFromRemoteIfStale();
    const visibleOrders = store.orders
      .filter((o) => !o.hiddenFromAdmin)
      .map(toAdminOrderDto);
    res.json({
      ok: true,
      orders: visibleOrders,
    });
  });

  // Admin-only cached binary endpoint for order payment screenshots (keeps live overview blazingly fast)
  app.get('/api/admin/orders/:orderId/screenshot', (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).send('Unauthorized');
      return;
    }
    const orderId = String(req.params.orderId || '').trim();
    const target = store.orders.find((o) => o.order_id === orderId);
    if (!target || !target.paymentScreenshot) {
      res.status(404).send('Not found');
      return;
    }
    const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(
      target.paymentScreenshot.trim(),
    );
    if (!match) {
      res.status(404).send('Not found');
      return;
    }
    const mime = match[1].toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${match[1].toLowerCase()}`;
    const buf = Buffer.from(match[2], 'base64');
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', 'inline');
    res.send(buf);
  });

  function resolveOrHydrateAdminOrder(
    orderId: string,
    snapshot?: Record<string, unknown>,
  ): StoredOrder | null {
    const found = store.orders.find((o) => o.order_id === orderId);
    if (found) return found;
    if (!snapshot || typeof snapshot !== 'object') return null;
    const uid = typeof snapshot.uid === 'string' && snapshot.uid ? snapshot.uid : '';
    if (!uid) return null;
    const idNum =
      typeof snapshot.id === 'number' && Number.isFinite(snapshot.id)
        ? snapshot.id
        : store.orderCounter++;
    if (idNum >= store.orderCounter) store.orderCounter = idNum + 1;
    const hydrated: StoredOrder = {
      id: idNum,
      order_id: orderId,
      service: String(snapshot.service || 'Order'),
      pack: String(snapshot.pack || ''),
      price: Number(snapshot.price) || 0,
      amount: Number(snapshot.amount ?? snapshot.price) || 0,
      link: String(snapshot.link || ''),
      status: 'pending',
      date: String(snapshot.date || formatIndianDateTime(Date.now())),
      createdAt: Number(snapshot.createdAt) || Date.now(),
      uid,
      app: typeof snapshot.app === 'string' ? snapshot.app : 'UPI',
      paymentScreenshot: '',
      screenshotHash: '',
      hiddenFromAdmin: false,
    };
    store.orders.unshift(hydrated);
    return hydrated;
  }

  // Admin updates order status (Successful / In Progress / Payment Failed) & pushes customer bell notification
  app.post('/api/admin/order-status', async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }

    await syncOrdersFromRemoteIfStale();
    const orderId = String(req.body?.order_id || '').trim();
    const rawStatus = String(req.body?.status || '').trim().toLowerCase();
    const note = String(req.body?.note || '').trim().slice(0, 200);

    let normalizedStatus: 'pending' | 'successful' | 'payment_failed' | null = null;
    if (rawStatus === 'successful' || rawStatus === 'completed') normalizedStatus = 'successful';
    else if (rawStatus === 'payment_failed' || rawStatus === 'failed') normalizedStatus = 'payment_failed';
    else if (rawStatus === 'pending' || rawStatus === 'in_progress' || rawStatus === 'in progress') {
      normalizedStatus = 'pending';
    }

    if (!normalizedStatus) {
      res.status(400).json({ ok: false, message: 'Invalid status' });
      return;
    }

    const target = resolveOrHydrateAdminOrder(orderId, req.body?.orderSnapshot);
    if (!target) {
      res.status(404).json({ ok: false, message: 'Order not found' });
      return;
    }

    const defaultMsg =
      normalizedStatus === 'successful'
        ? `Order #${target.id} Successful ✅`
        : normalizedStatus === 'payment_failed'
          ? `Order #${target.id} Payment Failed ❌`
          : `Order #${target.id} is In Progress ⏳`;

    const now = Math.max(
      Date.now(),
      (target.statusUpdatedAt || 0) + 1,
      (target.messageUpdatedAt || 0) + 1,
    );
    target.status = normalizedStatus;
    target.adminMessage = note || defaultMsg;
    target.statusUpdatedAt = now;
    target.messageUpdatedAt = now;

    const notif: StoredNotification = {
      id: `NOTIF_${now}_${crypto.randomInt(100, 999)}`,
      uid: target.uid,
      orderId: target.order_id,
      orderNum: target.id,
      service: target.service,
      pack: target.pack,
      status: normalizedStatus,
      message: note || defaultMsg,
      date: formatIndianDateTime(now),
      createdAt: now,
      read: false,
    };

    store.notifications.unshift(notif);
    saveStore(store);

    const adminDto = toAdminOrderDto(target);
    const customerDto = toCustomerOrderDto(target);

    broadcastToAdmins('order_updated', {
      order: adminDto,
      order_id: target.order_id,
      status: target.status,
    });
    broadcastToUser(target.uid, 'notification', {
      order: customerDto,
      notification: notif,
      id: notif.id,
      orderId: target.order_id,
      status: target.status,
      message: notif.message,
    });

    await persistOrderAndNotifRemote(target, notif);

    res.json({ ok: true, order: adminDto, customerOrder: customerDto, notification: notif });
  });

  // Admin explicitly deletes an order notification from Admin Panel (idempotent)
  app.delete('/api/admin/orders/:orderId', async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }

    const orderId = String(req.params.orderId || '').trim();
    const target = store.orders.find((o) => o.order_id === orderId);
    if (target) {
      target.hiddenFromAdmin = true;
      saveStore(store);
      await persistOrderAndNotifRemote(target);
    }

    broadcastToAdmins('order_deleted', { order_id: orderId });
    res.json({ ok: true, order_id: orderId });
  });

  // Admin sends a direct message to customer on an order without changing its current status
  app.post('/api/admin/order-message', async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }

    await syncOrdersFromRemoteIfStale();
    const orderId = String(req.body?.order_id || '').trim();
    const message = String(req.body?.message || '').trim().slice(0, 200);
    if (!message) {
      res.status(400).json({ ok: false, message: 'Message type karo ❌' });
      return;
    }

    const target = resolveOrHydrateAdminOrder(orderId, req.body?.orderSnapshot);
    if (!target) {
      res.status(404).json({ ok: false, message: 'Order not found' });
      return;
    }

    const now = Math.max(
      Date.now(),
      (target.messageUpdatedAt || 0) + 1,
      (target.statusUpdatedAt || 0) + 1,
    );
    target.adminMessage = message;
    target.messageUpdatedAt = now;

    const notif: StoredNotification = {
      id: `NOTIF_${now}_${crypto.randomInt(100, 999)}`,
      uid: target.uid,
      orderId: target.order_id,
      orderNum: target.id,
      service: target.service,
      pack: target.pack,
      status: target.status,
      message,
      date: formatIndianDateTime(now),
      createdAt: now,
      read: false,
    };

    store.notifications.unshift(notif);
    saveStore(store);

    const adminDto = toAdminOrderDto(target);
    const customerDto = toCustomerOrderDto(target);

    broadcastToAdmins('order_updated', {
      order: adminDto,
      order_id: target.order_id,
      status: target.status,
      adminMessage: target.adminMessage,
    });
    broadcastToUser(target.uid, 'notification', {
      order: customerDto,
      notification: notif,
      id: notif.id,
      orderId: target.order_id,
      status: target.status,
      message: notif.message,
    });

    await persistOrderAndNotifRemote(target, notif);

    res.json({ ok: true, order: adminDto, customerOrder: customerDto, notification: notif });
  });

  // Admin edits live service names, packages & prices (auto-updates scanner amount too)
  app.post('/api/admin/catalog', async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }

    const clientTs = Number(req.body?.clientUpdatedAt) || 0;
    const now = Math.max(Date.now(), clientTs, store.catalogUpdatedAt + 1);

    if (req.body?.reset === true) {
      store.catalogOverrides = undefined;
      store.catalogUpdatedAt = now;
      saveStore(store);
      const liveCatalog = getLiveCatalog(store);
      const catalogToken = makeCatalogToken();
      await persistCatalogRemote();
      broadcastToAdmins('catalog_updated', { ts: now });
      broadcastToAllUsers('catalog_updated', { ts: now });
      res.json({ ok: true, catalog: liveCatalog, catalogUpdatedAt: store.catalogUpdatedAt, catalogToken });
      return;
    }

    const incoming = req.body?.catalog;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ ok: false, message: 'Invalid catalog payload ❌' });
      return;
    }

    const nextOverrides: Record<string, ServerServiceItem[]> = getLiveCatalog(store);
    for (const catKey of Object.keys(SERVER_CATALOG)) {
      const catList = incoming[catKey];
      if (!Array.isArray(catList)) continue;

      const defaultById = new Map(SERVER_CATALOG[catKey].map((s) => [s.id, s]));
      const updatedCat: ServerServiceItem[] = [];
      for (const rawSvc of catList) {
        if (!rawSvc || typeof rawSvc.id !== 'string' || !defaultById.has(rawSvc.id)) continue;
        const cleanName = String(rawSvc.name || '').trim().slice(0, 80);
        if (!cleanName) {
          res.status(400).json({ ok: false, message: 'Service name khali nahi ho sakta ❌' });
          return;
        }
        const rawPrices = Array.isArray(rawSvc.prices) ? rawSvc.prices : [];
        const cleanPrices: ServerPriceTier[] = [];
        for (const tier of rawPrices) {
          const q = String(tier?.q || '').trim().slice(0, 60);
          const pNum = Number(tier?.p);
          if (!q || !Number.isFinite(pNum) || pNum < 1 || pNum > 100_000) {
            res.status(400).json({ ok: false, message: 'Har package ka naam aur valid price (₹1+) enter karo ❌' });
            return;
          }
          cleanPrices.push({ q, p: Math.round(pNum * 100) / 100 });
        }
        if (cleanPrices.length === 0) {
          res.status(400).json({ ok: false, message: 'Har service me kam se kam 1 package hona chahiye ❌' });
          return;
        }
        updatedCat.push({ id: rawSvc.id, name: cleanName, prices: cleanPrices });
      }
      if (updatedCat.length > 0) {
        nextOverrides[catKey] = updatedCat;
      }
    }

    store.catalogOverrides = nextOverrides;
    store.catalogUpdatedAt = now;
    saveStore(store);
    const liveCatalog = getLiveCatalog(store);
    const catalogToken = makeCatalogToken();
    await persistCatalogRemote();

    broadcastToAdmins('catalog_updated', { ts: now });
    broadcastToAllUsers('catalog_updated', { ts: now });

    res.json({ ok: true, catalog: liveCatalog, catalogUpdatedAt: store.catalogUpdatedAt, catalogToken });
  });

  // Admin changes Home Offer Poster live (or resets to default)
  app.post('/api/admin/poster', async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }

    hydrateCatalogFromSignedHeader(req);
    const clientTs = Number(req.body?.clientUpdatedAt) || 0;
    const now = Math.max(Date.now(), clientTs, store.posterUpdatedAt + 1);

    if (req.body?.reset === true || req.body?.posterImage === null) {
      store.posterImage = null;
      store.posterUpdatedAt = now;
      saveStore(store);
      await persistPosterRemote();
      broadcastToAdmins('catalog_updated', { ts: now });
      broadcastToAllUsers('catalog_updated', { ts: now });
      res.json({ ok: true, posterImage: null, posterUpdatedAt: store.posterUpdatedAt });
      return;
    }

    const imgCheck = sanitizeScreenshotDataUrl(req.body?.posterImage);
    if (!imgCheck.ok) {
      res.status(400).json({ ok: false, message: 'Valid poster image (PNG/JPG/WEBP, Max 1.5MB) upload karo ❌' });
      return;
    }

    store.posterImage = imgCheck.dataUrl;
    store.posterUpdatedAt = now;
    saveStore(store);
    await persistPosterRemote();
    broadcastToAdmins('catalog_updated', { ts: now });
    broadcastToAllUsers('catalog_updated', { ts: now });

    res.json({ ok: true, posterImage: store.posterImage, posterUpdatedAt: store.posterUpdatedAt });
  });

  return app;
}
