import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const ADMIN_PASS = 'banti&1945';
const FIREBASE_RTDB_URL = 'https://trusted-91b2d-default-rtdb.asia-southeast1.firebasedatabase.app';
const DATA_DIR = path.resolve(__dirname, '.data');
const STORE_FILE = path.join(DATA_DIR, 'trustedpanel_store.json');

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

interface StoredUtrRequest {
  id: string;
  uid: string;
  amount: number;
  utr: string;
  app: string;
  status: 'pending' | 'approved' | 'wrong_payment';
  adminMessage?: string;
  createdAt: number;
  date: string;
}

interface StoredOrder {
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
  utr?: string;
}

interface StoreData {
  wallets: Record<string, number>;
  utrRequests: StoredUtrRequest[];
  orders: StoredOrder[];
}

function loadStore(): StoreData {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
      return {
        wallets: parsed.wallets && typeof parsed.wallets === 'object' ? parsed.wallets : {},
        utrRequests: Array.isArray(parsed.utrRequests) ? parsed.utrRequests : [],
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      };
    }
  } catch {
    // Fallback to clean empty store if corrupt
  }
  return { wallets: {}, utrRequests: [], orders: [] };
}

function saveStore(store: StoreData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // Ignore disk write errors
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
    // Firebase RTDB rules may reject unauthenticated REST writes; local server store stays authoritative
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const store = loadStore();

  // Get user's live wallet balance, UTR fund requests, and orders
  app.get('/api/user-state/:uid', (req, res) => {
    const uid = String(req.params.uid || '').trim();
    if (!uid) {
      res.status(400).json({ ok: false, message: 'UID required' });
      return;
    }
    const balance = typeof store.wallets[uid] === 'number' ? store.wallets[uid] : 0;
    const utrRequests = store.utrRequests.filter((r) => r.uid === uid);
    const orders = store.orders.filter((o) => o.uid === uid);
    res.json({ ok: true, balance, utrRequests, orders });
  });

  // Submit a UTR payment request (Min ₹1)
  app.post('/api/utr', async (req, res) => {
    const uid = String(req.body?.uid || '').trim();
    const amount = Number(req.body?.amount);
    const utr = String(req.body?.utr || '').trim();
    const appName = String(req.body?.app || 'UPI').trim();

    if (!uid) {
      res.status(400).json({ ok: false, message: 'User ID missing' });
      return;
    }
    if (!Number.isFinite(amount) || amount < 1) {
      res.status(400).json({ ok: false, message: 'Minimum Add Fund ₹1 hai' });
      return;
    }
    if (utr.length < 6) {
      res.status(400).json({ ok: false, message: 'Valid UTR number enter karo (min 6 digits)' });
      return;
    }

    const now = Date.now();
    const record: StoredUtrRequest = {
      id: `UTR_${now}_${Math.floor(Math.random() * 1000)}`,
      uid,
      amount: Math.round(amount * 100) / 100,
      utr,
      app: appName,
      status: 'pending',
      createdAt: now,
      date: formatIndianDateTime(now),
    };

    store.utrRequests.unshift(record);
    saveStore(store);
    void syncToFirebase(`fund_requests/${record.id}`, record);

    res.json({ ok: true, request: record });
  });

  // Place an order & deduct wallet balance on server
  app.post('/api/orders', async (req, res) => {
    const order = req.body?.order as StoredOrder | undefined;
    if (!order || !order.uid || !order.order_id) {
      res.status(400).json({ ok: false, message: 'Invalid order payload' });
      return;
    }

    const linkCheck = validateOrderLinkOnServer({
      link: order.link,
      category: typeof req.body?.category === 'string' ? req.body.category : undefined,
      serviceId: typeof req.body?.serviceId === 'string' ? req.body.serviceId : undefined,
      serviceName: order.service,
    });
    if (!linkCheck.ok) {
      res.status(400).json({ ok: false, reason: 'invalid_link', message: linkCheck.message });
      return;
    }

    const currentBal = typeof store.wallets[order.uid] === 'number' ? store.wallets[order.uid] : 0;
    if (currentBal < order.price) {
      res.status(400).json({ ok: false, message: 'Low Balance ❌ Please Add Funds', balance: currentBal });
      return;
    }

    const nextBal = Math.max(0, Math.round((currentBal - order.price) * 100) / 100);
    store.wallets[order.uid] = nextBal;

    // Attach latest approved UTR submitted by this user (or latest UTR)
    const latestUtr =
      order.utr ||
      store.utrRequests.find((r) => r.uid === order.uid && r.status === 'approved')?.utr ||
      store.utrRequests.find((r) => r.uid === order.uid)?.utr ||
      undefined;

    const savedOrder: StoredOrder = {
      ...order,
      date: formatIndianDateTime(Date.now()),
      utr: latestUtr,
    };

    store.orders.unshift(savedOrder);
    saveStore(store);
    void syncToFirebase(`orders/${savedOrder.order_id}`, savedOrder);
    void syncToFirebase(`wallets/${savedOrder.uid}`, { balance: nextBal });

    res.json({ ok: true, order: savedOrder, balance: nextBal });
  });

  // Admin password verification & overview
  app.post('/api/admin/login', (req, res) => {
    const password = String(req.body?.password || '');
    if (password !== ADMIN_PASS) {
      res.status(401).json({ ok: false, message: 'Wrong Password ❌' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/overview', (req, res) => {
    const pass = String(req.headers['x-admin-pass'] || '');
    if (pass !== ADMIN_PASS) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }
    res.json({
      ok: true,
      utrRequests: store.utrRequests,
      orders: store.orders,
      wallets: store.wallets,
    });
  });

  app.post('/api/admin/utr-action', async (req, res) => {
    const pass = String(req.headers['x-admin-pass'] || '');
    if (pass !== ADMIN_PASS) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }

    const id = String(req.body?.id || '');
    const action = String(req.body?.action || '');
    const note = String(req.body?.note || '').trim();

    const target = store.utrRequests.find((r) => r.id === id);
    if (!target) {
      res.status(404).json({ ok: false, message: 'UTR request not found' });
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
      void syncToFirebase(`fund_requests/${target.id}`, target);
      void syncToFirebase(`wallets/${target.uid}`, { balance: nextBal });
      res.json({ ok: true, request: target, walletBalance: nextBal });
      return;
    }

    if (action === 'wrong_payment') {
      target.status = 'wrong_payment';
      target.adminMessage = note || 'Wrong Payment / Invalid UTR ❌';
      saveStore(store);
      void syncToFirebase(`fund_requests/${target.id}`, target);
      res.json({ ok: true, request: target });
      return;
    }

    res.status(400).json({ ok: false, message: 'Invalid action' });
  });

  app.post('/api/admin/order-status', async (req, res) => {
    const pass = String(req.headers['x-admin-pass'] || '');
    if (pass !== ADMIN_PASS) {
      res.status(401).json({ ok: false, message: 'Unauthorized' });
      return;
    }

    const orderId = String(req.body?.order_id || '');
    const status = String(req.body?.status || '').trim();
    const target = store.orders.find((o) => o.order_id === orderId);
    if (!target) {
      res.status(404).json({ ok: false, message: 'Order not found' });
      return;
    }

    target.status = status;
    saveStore(store);
    void syncToFirebase(`orders/${target.order_id}`, target);
    res.json({ ok: true, order: target });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrustedPanel server listening on http://localhost:${PORT}`);
  });
}

startServer();
