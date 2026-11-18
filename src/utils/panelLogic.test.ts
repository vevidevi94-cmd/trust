import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOrderDeduction,
  createOrderRecord,
  creditWalletBalance,
  detectNewPendingUtrIds,
  formatBalance,
  formatIndianDateTime,
  generateUserId,
  getOrderStatusBadgeStyle,
  getUtrStatusBadgeStyle,
  parseHashPage,
  validateFundAmount,
  validateOrderPlacement,
  validatePlatformLink,
  validateUtrInput,
  verifyAdminPassword,
} from './panelLogic';

test('formatIndianDateTime formats UTC timestamp in Asia/Kolkata IST', () => {
  // 2026-11-18T14:12:51Z -> +5:30 IST = 18/11/2026, 07:42:51 pm
  const utcMs = Date.UTC(2026, 10, 18, 14, 12, 51);
  const formatted = formatIndianDateTime(utcMs).toLowerCase();
  assert.ok(formatted.includes('18/11/2026'), `Expected 18/11/2026 in ${formatted}`);
  assert.ok(formatted.includes('07:42:51') || formatted.includes('7:42:51'), `Expected 7:42:51 in ${formatted}`);
  assert.ok(formatted.includes('pm'), `Expected pm in ${formatted}`);
});

test('generateUserId produces TRUST-XXXX in 1000..9999', () => {
  assert.equal(generateUserId(() => 0), 'TRUST-1000');
  assert.equal(generateUserId(() => 0.9999), 'TRUST-9999');
  assert.match(generateUserId(), /^TRUST-\d{4}$/);
});

test('formatBalance formats numeric amounts to two decimal places', () => {
  assert.equal(formatBalance(0), '0.00');
  assert.equal(formatBalance(100), '100.00');
  assert.equal(formatBalance(12.5), '12.50');
});

test('validateFundAmount enforces minimum ₹1', () => {
  assert.deepEqual(validateFundAmount(''), { ok: false, message: 'Minimum Add Fund ₹1 hai' });
  assert.deepEqual(validateFundAmount('0'), { ok: false, message: 'Minimum Add Fund ₹1 hai' });
  assert.deepEqual(validateFundAmount('0.5'), { ok: false, message: 'Minimum Add Fund ₹1 hai' });
  assert.deepEqual(validateFundAmount('1'), { ok: true, amount: 1 });
  assert.deepEqual(validateFundAmount('40'), { ok: true, amount: 40 });
  assert.deepEqual(validateFundAmount('150.5'), { ok: true, amount: 150.5 });
});

test('validateUtrInput requires minimum 6 alphanumeric characters', () => {
  assert.deepEqual(validateUtrInput('12345'), {
    ok: false,
    message: 'Valid UTR number enter karo (min 6 digits)',
  });
  assert.deepEqual(validateUtrInput(' 4321 9876 5432 '), {
    ok: true,
    utr: '432198765432',
  });
});

test('verifyAdminPassword checks exact password banti&1945', () => {
  assert.equal(verifyAdminPassword('wrong'), false);
  assert.equal(verifyAdminPassword('banti&1945 '), false);
  assert.equal(verifyAdminPassword('banti&1945'), true);
});

test('detectNewPendingUtrIds detects only unseen pending requests', () => {
  const known = new Set(['u1', 'u2']);
  const incoming = [
    {
      id: 'u1',
      uid: 'TRUST-1111',
      amount: 40,
      utr: '111111',
      app: 'GPay',
      status: 'pending' as const,
      createdAt: 1,
      date: 'd',
    },
    {
      id: 'u3',
      uid: 'TRUST-2222',
      amount: 100,
      utr: '999999',
      app: 'PhonePe',
      status: 'pending' as const,
      createdAt: 2,
      date: 'd',
    },
    {
      id: 'u4',
      uid: 'TRUST-3333',
      amount: 50,
      utr: '888888',
      app: 'BHIM',
      status: 'approved' as const,
      createdAt: 3,
      date: 'd',
    },
  ];
  assert.deepEqual(detectNewPendingUtrIds(known, incoming), ['u3']);
});

test('validatePlatformLink rejects wrong domains and invalid service URLs', () => {
  // Random text rejected
  assert.equal(
    validatePlatformLink({ link: 'hello', category: 'instagram', serviceId: 'ig-indian-follower' }).ok,
    false,
  );
  // YouTube link rejected for Instagram
  assert.equal(
    validatePlatformLink({
      link: 'https://youtube.com/@demo',
      category: 'instagram',
      serviceId: 'ig-indian-follower',
    }).ok,
    false,
  );
  // Instagram Post link rejected for Reels Views (ig-reels-1rs), Reel link accepted
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
  // Facebook requires facebook.com / fb.com
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
  // Telegram requires t.me and post ID for views
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
      link: 'https://t.me/mychannel',
      category: 'telegram',
      serviceId: 'tg-members',
    }).ok,
    true,
  );
  // YouTube requires youtube.com / youtu.be and video link for views
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
  assert.equal(
    validatePlatformLink({
      link: 'https://www.youtube.com/@creator',
      category: 'youtube',
      serviceId: 'yt-subs',
    }).ok,
    true,
  );
});

test('validateOrderPlacement checks link, platform validity, selected package, and balance', () => {
  assert.deepEqual(
    validateOrderPlacement({
      link: '   ',
      linkPrompt: 'Enter Your Reels Link',
      category: 'instagram',
      serviceId: 'ig-reels-1rs',
      selectedPrice: { q: '1K Reels Views', p: 1 },
      balance: 100,
    }),
    { ok: false, reason: 'missing_link', message: 'Please Enter Your Reels Link' },
  );

  const wrongLink = validateOrderPlacement({
    link: 'https://youtube.com/watch?v=123',
    linkPrompt: 'Enter Your Reels Link',
    category: 'instagram',
    serviceId: 'ig-reels-1rs',
    selectedPrice: { q: '1K Reels Views', p: 1 },
    balance: 100,
  });
  assert.equal(wrongLink.ok, false);
  if (!wrongLink.ok) {
    assert.equal(wrongLink.reason, 'invalid_link');
  }

  assert.deepEqual(
    validateOrderPlacement({
      link: 'https://instagram.com/reel/abc123',
      linkPrompt: 'Enter Your Reels Link',
      category: 'instagram',
      serviceId: 'ig-reels-1rs',
      selectedPrice: { q: '10K Reels Views', p: 10 },
      balance: 5,
    }),
    { ok: false, reason: 'low_balance', message: 'Low Balance ❌ Please Add Funds' },
  );

  assert.deepEqual(
    validateOrderPlacement({
      link: 'https://instagram.com/reel/abc123',
      linkPrompt: 'Enter Your Reels Link',
      category: 'instagram',
      serviceId: 'ig-reels-1rs',
      selectedPrice: { q: '10K Reels Views', p: 10 },
      balance: 10,
    }),
    { ok: true },
  );
});

test('wallet credit, order deduction, and order record with UTR stay consistent', () => {
  const afterCredit = creditWalletBalance(0, 100);
  assert.equal(afterCredit, 100);

  const afterOrder = applyOrderDeduction(afterCredit, 30);
  assert.equal(afterOrder, 70);

  const order = createOrderRecord({
    counter: 1,
    serviceName: 'INDIAN FOLLOWER 🇮🇳',
    pack: '10K Instagram Followers',
    price: 30,
    link: ' https://instagram.com/demo ',
    uid: 'TRUST-4242',
    utr: '432198765432',
    timestampMs: 1700000000000,
    dateStr: '15/11/2023, 03:43:20 am',
  });

  assert.equal(order.id, 1);
  assert.equal(order.order_id, 'ORD1700000000000');
  assert.equal(order.link, 'https://instagram.com/demo');
  assert.equal(order.utr, '432198765432');
  assert.equal(order.status, 'pending');
  assert.equal(order.uid, 'TRUST-4242');
});

test('status badge helpers return expected styles', () => {
  assert.equal(getOrderStatusBadgeStyle('pending').label, 'PENDING');
  assert.equal(getOrderStatusBadgeStyle('completed').label, 'COMPLETED');
  assert.equal(getUtrStatusBadgeStyle('pending').label, 'PENDING ⏳');
  assert.equal(getUtrStatusBadgeStyle('approved').label, 'FUND ADDED ✅');
  assert.equal(getUtrStatusBadgeStyle('wrong_payment').label, 'WRONG PAYMENT ❌');
});

test('parseHashPage routes valid top-level hashes including #admin', () => {
  assert.equal(parseHashPage('#orders'), 'orders');
  assert.equal(parseHashPage('#fund'), 'fund');
  assert.equal(parseHashPage('#menu'), 'menu');
  assert.equal(parseHashPage('#admin'), 'admin');
  assert.equal(parseHashPage('#home'), 'home');
  assert.equal(parseHashPage(''), 'home');
});
