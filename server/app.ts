import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'banti&1945';
const FIREBASE_RTDB_URL =
  process.env.FIREBASE_RTDB_URL ||
  'https://trusted-91b2d-default-rtdb.asia-southeast1.firebasedatabase.app';

// Stable HMAC signing key across serverless cold starts without exposing any secret to clients
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
const MIN_ADD_FUND = 1;
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

export interface StoredPaymentRequest {
  id: string;
  uid: string;
  amount: number;
  app: string;
  screenshot: string;
  screenshotHash: string;
  status: 'pending' | 'approved' | 'wrong_payment';
  adminMessage?: string;
  createdAt: number;
  date: string;
}

export interface StoredOrder {
  id: number;
  order_id: string;
  service: string;
  pack: string;
  price: number;
  amount: number;
  link: string;
  status: string;
  date: string;
  uid: string;
  paymentId?: string;
  paymentScreenshot?: string;
}

interface StoreData {
  wallets: Record<string, number>;
  paymentRequests: StoredPaymentRequest[];
  orders: StoredOrder[];
  orderCounter: number;
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
      const rawRequests = Array.isArray(parsed.paymentRequests)
        ? parsed.paymentRequests
        : Array.isArray(parsed.utrRequests)
          ? parsed.utrRequests
          : [];
      const orders = Array.isArray(parsed.orders) ? parsed.orders : [];
      const maxId = orders.reduce(
        (m: number, o: { id?: number }) => (typeof o.id === 'number' && o.id > m ? o.id : m),
        0,
      );
      return {
        wallets: parsed.wallets && typeof parsed.wallets === 'object' ? parsed.wallets : {},
        paymentRequests: rawRequests,
        orders,
        orderCounter:
          typeof parsed.orderCounter === 'number' && parsed.orderCounter > maxId
            ? parsed.orderCounter
            : maxId + 1,
      };
    }
  } catch {
    // Fallback to clean store
  }
  return { wallets: {}, paymentRequests: [], orders: [], orderCounter: 1 };
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

async function syncToFirebase(subPath: string, payload: unknown): Promise<void> {
  try {
    await fetch(`${FIREBASE_RTDB_URL}/${subPath}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Firebase RTDB rules may reject unauthenticated REST writes
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

function setSessionCookie(res: Response, req: Request, name: string, value: string, maxAgeSec: number): void {
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
    // Constant-time dummy comparison to avoid length timing leak
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

function getOrIssueUserSession(
  req: Request,
  res: Response,
  store: StoreData,
): { uid: string; sid: string } {
  const cookies = parseCookies(req);
  const verified = verifyToken<{ uid?: string; sid?: string }>(cookies[USER_COOKIE]);
  if (verified?.uid && verified?.sid && /^TRUST-\d{4}$/.test(verified.uid)) {
    return { uid: verified.uid, sid: verified.sid };
  }

  // Generate fresh unique UID on server
  let uid = '';
  for (let i = 0; i < 12; i++) {
    const num = crypto.randomInt(1000, 10000);
    const candidate = `TRUST-${num}`;
    if (!(candidate in store.wallets)) {
      uid = candidate;
      break;
    }
  }
  if (!uid) {
    uid = `TRUST-${crypto.randomInt(1000, 10000)}`;
  }

  const sid = crypto.randomBytes(16).toString('hex');
  const token = signToken({
    uid,
    sid,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  });
  setSessionCookie(res, req, USER_COOKIE, token, 60 * 60 * 24 * 30);
  return { uid, sid };
}

function getVerifiedUserSession(req: Request): { uid: string; sid: string } | null {
  const cookies = parseCookies(req);
  const verified = verifyToken<{ uid?: string; sid?: string }>(cookies[USER_COOKIE]);
  if (verified?.uid && verified?.sid && /^TRUST-\d{4}$/.test(verified.uid)) {
    return { uid: verified.uid, sid: verified.sid };
  }
  return null;
}

function isAdminAuthenticated(req: Request): boolean {
  const cookies = parseCookies(req);
  const verified = verifyToken<{ role?: string }>(cookies[ADMIN_COOKIE]);
  return verified?.role === 'admin';
}

function sanitizeScreenshotDataUrl(raw: unknown): { ok: true; dataUrl: string; hash: string } | { ok: false; message: string } {
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

  function pruneTokens() {
    const now = Date.now();
    for (const [jti, exp] of usedQrTokens.entries()) {
      if (exp < now) usedQrTokens.delete(jti);
    }
    for (const [ip, rec] of loginFailures.entries()) {
      if (rec.resetAt < now) loginFailures.delete(ip);
    }
  }

  // Authenticated user's own state (no :uid enumeration possible)
  app.get('/api/user-state', (req, res) => {
    const session = getOrIssueUserSession(req, res, store);
    const balance = typeof store.wallets[session.uid] === 'number' ? store.wallets[session.uid] : 0;

    // Strip raw payment screenshot binary from user polling list so private receipt data is not echoed repeatedly
    const paymentRequests = store.paymentRequests
      .filter((r) => r.uid === session.uid)
      .map((r) => ({
        id: r.id,
        uid: r.uid,
        amount: r.amount,
        app: r.app,
        status: r.status,
        adminMessage: r.adminMessage,
        createdAt: r.createdAt,
        date: r.date,
        hasScreenshot: true,
      }));

    const orders = store.orders
      .filter((o) => o.uid === session.uid)
      .map((o) => ({
        id: o.id,
        order_id: o.order_id,
        service: o.service,
        pack: o.pack,
        price: o.price,
        amount: o.amount,
        link: o.link,
        status: o.status,
        date: o.date,
        uid: o.uid,
        hasPaymentScreenshot: Boolean(o.paymentScreenshot || o.paymentId),
      }));

    res.json({
      ok: true,
      uid: session.uid,
      balance,
      paymentRequests,
      orders,
    });
  });

  // Start a protected checkout session & get single-use QR token
  app.post('/api/fund/checkout', (req, res) => {
    pruneTokens();
    const session = getOrIssueUserSession(req, res, store);
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < MIN_ADD_FUND) {
      res.status(400).json({ ok: false, message: `Minimum Add Fund ₹${MIN_ADD_FUND} hai` });
      return;
    }
    const cleanAmount = Math.round(amount * 100) / 100;
    const jti = crypto.randomBytes(12).toString('hex');
    const qrToken = signToken({
      uid: session.uid,
      sid: session.sid,
      amt: cleanAmount,
      jti,
      exp: Date.now() + 180_000,
    });
    res.json({ ok: true, amount: cleanAmount, qrToken });
  });

  // Serve protected QR image once per checkout token (no static URL, no public access)
  app.get('/api/fund/qr', (req, res) => {
    pruneTokens();
    const session = getVerifiedUserSession(req);
    if (!session) {
      res.status(403).send('Forbidden');
      return;
    }
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const decoded = verifyToken<{ uid?: string; sid?: string; jti?: string; exp?: number }>(token);
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

    const qrPath = resolveQrImagePath();
    if (!qrPath) {
      res.status(404).send('Not found');
      return;
    }

    // Single-use token: consume immediately so direct link replay fails
    usedQrTokens.set(decoded.jti, typeof decoded.exp === 'number' ? decoded.exp : Date.now() + 180_000);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(qrPath).pipe(res);
  });

  // Submit a Payment Screenshot request (Min ₹1)
  app.post('/api/fund/submit-screenshot', async (req, res) => {
    const session = getVerifiedUserSession(req);
    if (!session) {
      res.status(401).json({ ok: false, message: 'Session expired. Page reload karo ❌' });
      return;
    }

    const amount = Number(req.body?.amount);
    const appName = String(req.body?.app || 'UPI').trim().slice(0, 30);

    if (!Number.isFinite(amount) || amount < MIN_ADD_FUND) {
      res.status(400).json({ ok: false, message: `Minimum Add Fund ₹${MIN_ADD_FUND} hai` });
      return;
    }

    const imgCheck = sanitizeScreenshotDataUrl(req.body?.screenshot);
    if (!imgCheck.ok) {
      res.status(400).json({ ok: false, message: imgCheck.message });
      return;
    }

    // Prevent exact screenshot replay across pending/approved payments
    const duplicate = store.paymentRequests.find(
      (r) => r.screenshotHash === imgCheck.hash && r.status !== 'wrong_payment',
    );
    if (duplicate) {
      res.status(400).json({
        ok: false,
        message: 'Yeh payment screenshot pehle hi submit ho chuka hai ❌',
      });
      return;
    }

    const now = Date.now();
    const record: StoredPaymentRequest = {
      id: `PAY_${now}_${crypto.randomInt(100, 999)}`,
      uid: session.uid,
      amount: Math.round(amount * 100) / 100,
      app: appName,
      screenshot: imgCheck.dataUrl,
      screenshotHash: imgCheck.hash,
      status: 'pending',
      createdAt: now,
      date: formatIndianDateTime(now),
    };

    store.paymentRequests.unshift(record);
    saveStore(store);
    void syncToFirebase(`fund_requests/${record.id}`, {
      id: record.id,
      uid: record.uid,
      amount: record.amount,
      app: record.app,
      status: record.status,
      createdAt: record.createdAt,
      date: record.date,
    });

    res.json({
      ok: true,
      request: {
        id: record.id,
        uid: record.uid,
        amount: record.amount,
        app: record.app,
        status: record.status,
        createdAt: record.createdAt,
        date: record.date,
        hasScreenshot: true,
      },
    });
  });

  // Server-authoritative order placement (price, service, uid, balance all enforced on server)
  app.post('/api/orders', async (req, res) => {
    const session = getVerifiedUserSession(req);
    if (!session) {
      res.status(401).json({ ok: false, message: 'Session expired. Page reload karo ❌' });
      return;
    }

    const category = String(req.body?.category || '').trim();
    const serviceId = String(req.body?.serviceId || '').trim();
    const packIndex = Number(req.body?.packIndex);
    const link = String(req.body?.link || '').trim();

    const catServices = SERVER_CATALOG[category];
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
    const currentBal = typeof store.wallets[session.uid] === 'number' ? store.wallets[session.uid] : 0;
    if (currentBal < packTier.p) {
      res.status(400).json({
        ok: false,
        reason: 'low_balance',
        message: 'Low Balance ❌ Please Add Funds',
        balance: currentBal,
      });
      return;
    }

    const nextBal = Math.max(0, Math.round((currentBal - packTier.p) * 100) / 100);
    store.wallets[session.uid] = nextBal;

    const latestPayment =
      store.paymentRequests.find((r) => r.uid === session.uid && r.status === 'approved') ??
      store.paymentRequests.find((r) => r.uid === session.uid);

    const now = Date.now();
    const orderNum = store.orderCounter++;
    const savedOrder: StoredOrder = {
      id: orderNum,
      order_id: `ORD${now}`,
      service: service.name,
      pack: packTier.q,
      price: packTier.p,
      amount: packTier.p,
      link,
      status: 'pending',
      date: formatIndianDateTime(now),
      uid: session.uid,
      paymentId: latestPayment?.id,
      paymentScreenshot: latestPayment?.screenshot,
    };

    store.orders.unshift(savedOrder);
    saveStore(store);
    void syncToFirebase(`orders/${savedOrder.order_id}`, {
      id: savedOrder.id,
      order_id: savedOrder.order_id,
      service: savedOrder.service,
      pack: savedOrder.pack,
      price: savedOrder.price,
      link: savedOrder.link,
      status: savedOrder.status,
      date: savedOrder.date,
      uid: savedOrder.uid,
      paymentId: savedOrder.paymentId,
    });
    void syncToFirebase(`wallets/${session.uid}`, { balance: nextBal });

    res.json({
      ok: true,
      order: {
        id: savedOrder.id,
        order_id: savedOrder.order_id,
        service: savedOrder.service,
        pack: savedOrder.pack,
        price: savedOrder.price,
        amount: savedOrder.amount,
        link: savedOrder.link,
        status: savedOrder.status,
        date: savedOrder.date,
        uid: savedOrder.uid,
        hasPaymentScreenshot: Boolean(savedOrder.paymentScreenshot || savedOrder.paymentId),
      },
      balance: nextBal,
    });
  });

  // Admin session check (no secret stored in browser localStorage)
  app.get('/api/admin/session', (req, res) => {
    res.json({ ok: true, authenticated: isAdminAuthenticated(req) });
  });

  // Admin login (timing-safe comparison + HttpOnly HMAC cookie + rate limiting)
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

  app.get('/api/admin/overview', (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }
    res.json({
      ok: true,
      paymentRequests: store.paymentRequests,
      orders: store.orders,
    });
  });

  app.post('/api/admin/payment-action', async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }

    const id = String(req.body?.id || '');
    const action = String(req.body?.action || '');
    const note = String(req.body?.note || '').trim().slice(0, 200);

    const target = store.paymentRequests.find((r) => r.id === id);
    if (!target) {
      res.status(404).json({ ok: false, message: 'Payment request not found' });
      return;
    }
    if (target.status !== 'pending') {
      res.status(400).json({ ok: false, message: 'Already processed' });
      return;
    }

    if (action === 'approve') {
      target.status = 'approved';
      target.adminMessage = note || `₹${target.amount.toFixed(2)} Fund Added ✅`;
      const prevBal = typeof store.wallets[target.uid] === 'number' ? store.wallets[target.uid] : 0;
      const nextBal = Math.round((prevBal + target.amount) * 100) / 100;
      store.wallets[target.uid] = nextBal;
      saveStore(store);
      void syncToFirebase(`fund_requests/${target.id}`, {
        id: target.id,
        uid: target.uid,
        amount: target.amount,
        status: target.status,
        adminMessage: target.adminMessage,
      });
      void syncToFirebase(`wallets/${target.uid}`, { balance: nextBal });
      res.json({ ok: true, request: target, walletBalance: nextBal });
      return;
    }

    if (action === 'wrong_payment') {
      target.status = 'wrong_payment';
      target.adminMessage = note || 'Wrong Payment / Invalid Screenshot ❌';
      saveStore(store);
      void syncToFirebase(`fund_requests/${target.id}`, {
        id: target.id,
        uid: target.uid,
        amount: target.amount,
        status: target.status,
        adminMessage: target.adminMessage,
      });
      res.json({ ok: true, request: target });
      return;
    }

    res.status(400).json({ ok: false, message: 'Invalid action' });
  });

  app.post('/api/admin/order-status', async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }

    const orderId = String(req.body?.order_id || '');
    const status = String(req.body?.status || '').trim();
    if (!['pending', 'in progress', 'completed', 'canceled'].includes(status.toLowerCase())) {
      res.status(400).json({ ok: false, message: 'Invalid status' });
      return;
    }

    const target = store.orders.find((o) => o.order_id === orderId);
    if (!target) {
      res.status(404).json({ ok: false, message: 'Order not found' });
      return;
    }

    target.status = status;
    saveStore(store);
    void syncToFirebase(`orders/${target.order_id}`, {
      order_id: target.order_id,
      status: target.status,
    });
    res.json({ ok: true, order: target });
  });

  return app;
}
