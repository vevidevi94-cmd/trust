import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countUnreadNotifications,
  detectNewOrderIds,
  formatIndianDateTime,
  generateUserId,
  getOrderStatusBadgeStyle,
  parseHashPage,
  validateDirectOrderInput,
  validatePaymentScreenshot,
  validatePlatformLink,
} from './panelLogic';

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

test('getOrderStatusBadgeStyle returns expected labels for pending, successful, payment_failed', () => {
  assert.equal(getOrderStatusBadgeStyle('pending').label, 'PENDING ⏳');
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
