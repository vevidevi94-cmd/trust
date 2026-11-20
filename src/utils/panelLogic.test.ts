import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_CATALOG } from '../data/services';
import {
  countUnreadNotifications,
  detectNewOrderIds,
  formatIndianDateTime,
  generateUserId,
  getOrderStatusBadgeStyle,
  mergeAdminOrders,
  mergeCustomerNotifications,
  mergeCustomerOrders,
  mergeLiveCatalog,
  parseHashPage,
  reconcileCatalogDrafts,
  shouldAdoptServerVersion,
  validateCatalogServiceEdit,
  validateDirectOrderInput,
  validatePaymentScreenshot,
  validatePlatformLink,
} from './panelLogic';

test('mergeAdminOrders keeps all non-deleted orders permanently across server resets', () => {
  const cached = [
    {
      id: 1,
      order_id: 'ORD1',
      service: '1rs = 1k Reels Views',
      pack: '1K Reels Views',
      price: 1,
      amount: 1,
      link: 'https://instagram.com/reel/a',
      status: 'successful',
      date: 'd',
      createdAt: 100,
      uid: 'TRUST-1111',
    },
    {
      id: 2,
      order_id: 'ORD2',
      service: 'FB FOLLOWERS',
      pack: '1K Followers',
      price: 30,
      amount: 30,
      link: 'https://facebook.com/demo',
      status: 'payment_failed',
      date: 'd',
      createdAt: 200,
      uid: 'TRUST-2222',
    },
  ];
  const merged = mergeAdminOrders({
    serverOrders: [],
    cachedOrders: cached,
    deletedIds: new Set(['ORD2']),
  });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].order_id, 'ORD1');
});

test('mergeAdminOrders locks Admin Successful status against stale server polls until Admin changes it', () => {
  const staleServerOrders = [
    {
      id: 1,
      order_id: 'ORD_LOCK',
      service: '1rs = 1k Reels Views',
      pack: '1K Reels Views',
      price: 1,
      amount: 1,
      link: 'https://instagram.com/reel/lock',
      status: 'pending',
      date: 'd',
      createdAt: 1000,
      uid: 'TRUST-1111',
    },
  ];
  const mergedLocked = mergeAdminOrders({
    serverOrders: staleServerOrders,
    cachedOrders: [],
    deletedIds: new Set(),
    statusOverrides: {
      ORD_LOCK: { status: 'successful', updatedAt: 2000 },
    },
  });
  assert.equal(mergedLocked[0].status, 'successful');

  // When Admin explicitly changes to payment_failed later, new override takes effect
  const mergedChanged = mergeAdminOrders({
    serverOrders: staleServerOrders,
    cachedOrders: mergedLocked,
    deletedIds: new Set(),
    statusOverrides: {
      ORD_LOCK: { status: 'payment_failed', updatedAt: 3000 },
    },
  });
  assert.equal(mergedChanged[0].status, 'payment_failed');
});

test('formatIndianDateTime formats UTC timestamp in Asia/Kolkata IST', () => {
  const utcMs = Date.UTC(2026, 10, 18, 14, 12, 51);
  const formatted = formatIndianDateTime(utcMs).toLowerCase();
  assert.ok(formatted.includes('18/11/2026'), `Expected 18/11/2026 in ${formatted}`);
  assert.ok(
    formatted.includes('07:42:51') || formatted.includes('7:42:51'),
    `Expected 7:42:51 in ${formatted}`,
  );
  assert.ok(formatted.includes('pm'), `Expected pm in ${formatted}`);
});

test('generateUserId produces TRUST-XXXX in 1000..9999', () => {
  assert.equal(generateUserId(() => 0), 'TRUST-1000');
  assert.equal(generateUserId(() => 0.9999), 'TRUST-9999');
  assert.match(generateUserId(), /^TRUST-\d{4}$/);
});

test('validatePaymentScreenshot requires valid image data URL', () => {
  assert.deepEqual(validatePaymentScreenshot(''), {
    ok: false,
    message: 'Payment ka screenshot upload karo ❌',
  });
  assert.deepEqual(validatePaymentScreenshot('not-an-image'), {
    ok: false,
    message: 'Payment ka screenshot upload karo ❌',
  });
  const sampleBase64 = 'A'.repeat(60);
  assert.deepEqual(validatePaymentScreenshot(`data:image/jpeg;base64,${sampleBase64}`), {
    ok: true,
    screenshot: `data:image/jpeg;base64,${sampleBase64}`,
  });
});

test('detectNewOrderIds detects newly arrived orders for live admin alert', () => {
  const known = new Set(['ORD1']);
  const incoming = [
    {
      id: 1,
      order_id: 'ORD1',
      service: '1rs = 1k Reels Views',
      pack: '1K Reels Views',
      price: 1,
      amount: 1,
      link: 'https://instagram.com/reel/a',
      status: 'pending',
      date: 'd',
      createdAt: 1,
      uid: 'TRUST-1111',
    },
    {
      id: 2,
      order_id: 'ORD2',
      service: '1rs = 1k Reels Views',
      pack: '2K Reels Views',
      price: 2,
      amount: 2,
      link: 'https://instagram.com/reel/b',
      status: 'pending',
      date: 'd',
      createdAt: 2,
      uid: 'TRUST-2222',
    },
  ];
  assert.deepEqual(detectNewOrderIds(known, incoming), ['ORD2']);
});

test('countUnreadNotifications counts unread customer alerts accurately', () => {
  const list = [
    {
      id: 'n1',
      orderId: 'ORD1',
      orderNum: 1,
      service: '1rs = 1k Reels Views',
      pack: '1K Reels Views',
      status: 'successful',
      message: 'Order Successful ✅',
      date: 'd',
      createdAt: 1,
      read: false,
    },
    {
      id: 'n2',
      orderId: 'ORD2',
      orderNum: 2,
      service: 'FB FOLLOWERS',
      pack: '1K Followers',
      status: 'payment_failed',
      message: 'Payment Failed ❌',
      date: 'd',
      createdAt: 2,
      read: true,
    },
  ];
  assert.equal(countUnreadNotifications(list), 1);
});

test('validatePlatformLink rejects wrong domains and invalid service URLs', () => {
  assert.equal(
    validatePlatformLink({ link: 'hello', category: 'instagram', serviceId: 'ig-indian-follower' }).ok,
    false,
  );
  assert.equal(
    validatePlatformLink({
      link: 'https://youtube.com/@demo',
      category: 'instagram',
      serviceId: 'ig-indian-follower',
    }).ok,
    false,
  );
  assert.equal(
    validatePlatformLink({
      link: 'https://www.instagram.com/p/C12345/',
      category: 'instagram',
      serviceId: 'ig-reels-1rs',
    }).ok,
    false,
  );
  assert.equal(
    validatePlatformLink({
      link: 'https://www.instagram.com/reel/C12345/',
      category: 'instagram',
      serviceId: 'ig-reels-1rs',
    }).ok,
    true,
  );
  assert.equal(
    validatePlatformLink({
      link: 'https://www.instagram.com/demo/',
      category: 'facebook',
      serviceId: 'fb-followers',
    }).ok,
    false,
  );
  assert.equal(
    validatePlatformLink({
      link: 'https://www.facebook.com/demo.page',
      category: 'facebook',
      serviceId: 'fb-page-likes',
    }).ok,
    true,
  );
  assert.equal(
    validatePlatformLink({
      link: 'https://t.me/mychannel',
      category: 'telegram',
      serviceId: 'tg-views',
    }).ok,
    false,
  );
  assert.equal(
    validatePlatformLink({
      link: 'https://t.me/mychannel/42',
      category: 'telegram',
      serviceId: 'tg-views',
    }).ok,
    true,
  );
  assert.equal(
    validatePlatformLink({
      link: 'https://www.youtube.com/@creator',
      category: 'youtube',
      serviceId: 'yt-views',
    }).ok,
    false,
  );
  assert.equal(
    validatePlatformLink({
      link: 'https://youtube.com/shorts/abc123',
      category: 'youtube',
      serviceId: 'yt-views',
    }).ok,
    true,
  );
});

test('validateDirectOrderInput checks link and package without wallet balance gate', () => {
  assert.deepEqual(
    validateDirectOrderInput({
      link: '   ',
      linkPrompt: 'Enter Your Reels Link',
      category: 'instagram',
      serviceId: 'ig-reels-1rs',
      selectedPrice: { q: '1K Reels Views', p: 1 },
    }),
    { ok: false, reason: 'missing_link', message: 'Please Enter Your Reels Link' },
  );

  const wrongLink = validateDirectOrderInput({
    link: 'https://youtube.com/watch?v=123',
    linkPrompt: 'Enter Your Reels Link',
    category: 'instagram',
    serviceId: 'ig-reels-1rs',
    selectedPrice: { q: '1K Reels Views', p: 1 },
  });
  assert.equal(wrongLink.ok, false);
  if (!wrongLink.ok) {
    assert.equal(wrongLink.reason, 'invalid_link');
  }

  assert.deepEqual(
    validateDirectOrderInput({
      link: 'https://instagram.com/reel/abc123',
      linkPrompt: 'Enter Your Reels Link',
      category: 'instagram',
      serviceId: 'ig-reels-1rs',
      selectedPrice: { q: '10K Reels Views', p: 10 },
    }),
    { ok: true },
  );
});

test('getOrderStatusBadgeStyle returns expected labels for in_progress, pending, successful, payment_failed', () => {
  assert.equal(getOrderStatusBadgeStyle('pending').label, 'IN PROGRESS ⏳');
  assert.equal(getOrderStatusBadgeStyle('in_progress').label, 'IN PROGRESS ⏳');
  assert.equal(getOrderStatusBadgeStyle('successful').label, 'SUCCESSFUL ✅');
  assert.equal(getOrderStatusBadgeStyle('payment_failed').label, 'PAYMENT FAILED ❌');
});

test('parseHashPage routes valid top-level hashes and defaults #fund to home', () => {
  assert.equal(parseHashPage('#orders'), 'orders');
  assert.equal(parseHashPage('#menu'), 'menu');
  assert.equal(parseHashPage('#admin'), 'admin');
  assert.equal(parseHashPage('#fund'), 'home');
  assert.equal(parseHashPage('#home'), 'home');
  assert.equal(parseHashPage(''), 'home');
});

test('mergeLiveCatalog applies Admin live price & name overrides while preserving icons and metadata', () => {
  const merged = mergeLiveCatalog(SERVICE_CATALOG, {
    instagram: [
      {
        id: 'ig-reels-1rs',
        name: '7rs = 1k Reels Views',
        prices: [
          { q: '1K Reels Views', p: 7 },
          { q: '5K Reels Views', p: 25 },
        ],
      },
    ],
  });
  const reels = merged.instagram.find((s) => s.id === 'ig-reels-1rs');
  assert.ok(reels);
  assert.equal(reels.name, '7rs = 1k Reels Views');
  assert.equal(reels.icon, 'instagram');
  assert.equal(reels.prices.length, 2);
  assert.equal(reels.prices[0].p, 7);
});

test('validateCatalogServiceEdit enforces non-empty name and valid positive prices', () => {
  assert.equal(validateCatalogServiceEdit({ name: '   ', prices: [{ q: '1K', p: 5 }] }).ok, false);
  assert.equal(validateCatalogServiceEdit({ name: 'Reels', prices: [{ q: '1K', p: 0 }] }).ok, false);
  assert.deepEqual(
    validateCatalogServiceEdit({ name: ' 5rs Reels ', prices: [{ q: ' 1K Views ', p: 5 }] }),
    { ok: true, name: '5rs Reels', prices: [{ q: '1K Views', p: 5 }] },
  );
});

test('shouldAdoptServerVersion prevents cold or stale server polls from reverting Admin edits', () => {
  assert.equal(shouldAdoptServerVersion({ localUpdatedAt: 5000, serverUpdatedAt: 0 }), false);
  assert.equal(shouldAdoptServerVersion({ localUpdatedAt: 5000, serverUpdatedAt: 4000 }), false);
  assert.equal(shouldAdoptServerVersion({ localUpdatedAt: 5000, serverUpdatedAt: 5000 }), true);
  assert.equal(shouldAdoptServerVersion({ localUpdatedAt: 5000, serverUpdatedAt: 6000 }), true);
  assert.equal(shouldAdoptServerVersion({ localUpdatedAt: 0, serverUpdatedAt: 0 }), true);
});

test('reconcileCatalogDrafts preserves unsaved Admin edits while syncing clean services', () => {
  const currentDrafts = [
    {
      id: 'ig-reels-1rs',
      name: 'Typing New Name...',
      prices: [{ q: '1K Reels Views', p: '9' }],
    },
    {
      id: 'ig-bluetik',
      name: 'OLD NAME',
      prices: [{ q: 'BLUE TIK', p: '100' }],
    },
  ];
  const incomingServices = SERVICE_CATALOG.instagram.slice(0, 2).map((s) =>
    s.id === 'ig-bluetik' ? { ...s, name: 'UPDATED SERVER NAME' } : s,
  );
  const next = reconcileCatalogDrafts({
    currentDrafts,
    incomingServices,
    dirtyServiceIds: new Set(['ig-reels-1rs']),
  });
  const dirtyReels = next.find((d) => d.id === 'ig-reels-1rs');
  const cleanBlueTik = next.find((d) => d.id === 'ig-bluetik');
  assert.equal(dirtyReels?.name, 'Typing New Name...');
  assert.equal(dirtyReels?.prices[0].p, '9');
  assert.equal(cleanBlueTik?.name, 'UPDATED SERVER NAME');
});

test('mergeCustomerOrders never reverts newer status or adminMessage on stale poll', () => {
  const cached = [
    {
      id: 1,
      order_id: 'ORD_C1',
      service: '1rs = 1k Reels Views',
      pack: '1K Reels Views',
      price: 1,
      amount: 1,
      link: 'https://instagram.com/reel/abc',
      status: 'payment_failed',
      adminMessage: 'Payment screenshot unclear, resend karo',
      statusUpdatedAt: 5000,
      messageUpdatedAt: 6000,
      date: 'd',
      createdAt: 1000,
      uid: 'TRUST-1111',
    },
  ];
  const staleServer = [
    {
      id: 1,
      order_id: 'ORD_C1',
      service: '1rs = 1k Reels Views',
      pack: '1K Reels Views',
      price: 1,
      amount: 1,
      link: 'https://instagram.com/reel/abc',
      status: 'pending',
      date: 'd',
      createdAt: 1000,
      uid: 'TRUST-1111',
    },
  ];
  const merged = mergeCustomerOrders({
    serverOrders: staleServer,
    cachedOrders: cached,
    uid: 'TRUST-1111',
  });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'payment_failed');
  assert.equal(merged[0].adminMessage, 'Payment screenshot unclear, resend karo');

  // Newer explicit status update from server takes effect immediately
  const newerServer = [
    {
      ...staleServer[0],
      status: 'successful',
      adminMessage: 'Order #1 Successful ✅',
      statusUpdatedAt: 7000,
      messageUpdatedAt: 7000,
    },
  ];
  const updated = mergeCustomerOrders({
    serverOrders: newerServer,
    cachedOrders: merged,
    uid: 'TRUST-1111',
  });
  assert.equal(updated[0].status, 'successful');
  assert.equal(updated[0].adminMessage, 'Order #1 Successful ✅');
});

test('mergeCustomerNotifications unions alerts without dropping messages and preserves read state', () => {
  const cached = [
    {
      id: 'N1',
      orderId: 'ORD1',
      orderNum: 1,
      service: 'Reels',
      pack: '1K',
      status: 'pending',
      message: 'Started',
      date: 'd',
      createdAt: 100,
      read: true,
    },
    {
      id: 'N2',
      orderId: 'ORD1',
      orderNum: 1,
      service: 'Reels',
      pack: '1K',
      status: 'successful',
      message: 'Custom Admin Message',
      date: 'd',
      createdAt: 200,
      read: false,
    },
  ];
  const staleServer = [
    { ...cached[0], read: false },
  ];
  const merged = mergeCustomerNotifications({
    serverNotifications: staleServer,
    cachedNotifications: cached,
  });
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'N2');
  assert.equal(merged[0].read, false);
  assert.equal(merged[1].id, 'N1');
  assert.equal(merged[1].read, true);
});
