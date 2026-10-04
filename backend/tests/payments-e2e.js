/**
 * Payments, returns & refunds E2E test suite.
 * Style follows ../mech-e2e.js — node + fetch, PASS/FAIL lines, random users, exit 1 on failure.
 */
const SR = 'http://localhost:4000';
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const PW = 'Test@12345678';
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE || '9000000001';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin@12345678';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '8e1451e4ef36038c750e04ac930f69fc53f46686f6e17ace733142f83bdf9977';

const find = (o, k) => {
  if (o && typeof o === 'object') {
    if (k in o && o[k] != null) return o[k];
    for (const v of Object.values(o)) { const r = find(v, k); if (r != null) return r; }
  }
};

let fails = 0;

async function call(label, method, path, body, token, expect = [200, 201], extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(SR + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  const ok = [].concat(expect).includes(res.status);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${res.status}] ${label}`);
  if (!ok || process.env.VERBOSE) console.log('    ', JSON.stringify(json).replace(/(\"(?:accessToken|refreshToken)\":\")[^\"]+/g, '$1***').slice(0, 800));
  return json;
}

function check(label, cond, extra) {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}       ${label}${cond ? '' : '  -> ' + JSON.stringify(extra).slice(0, 300)}`);
}

async function directSql(sql) {
  // Use a small helper: POST to an ad-hoc endpoint won't exist, so we use psql via env
  // Instead we use the internal DB connection. We run a child process.
  const { execSync } = require('child_process');
  const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/spareparts_db';
  execSync(`psql "${dbUrl}" -c "${sql.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
}

(async () => {
  console.log('\n====== PAYMENTS / RETURNS / REFUNDS E2E ======\n');

  // --- Setup: admin, seller, buyer, delivery partner ---
  const aLogin = await call('admin login', 'POST', '/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD });
  const aTok = find(aLogin, 'accessToken');

  async function makeSeller(tag) {
    const phone = '9' + rnd() + '1';
    const reg = await call('register seller ' + tag, 'POST', '/api/auth/register', { fullName: 'Pay Seller ' + tag + ' ' + rnd(), phone, password: PW, role: 'seller' });
    const tok = find(reg, 'accessToken');
    const ini = await call('kyc initiate ' + tag, 'POST', '/api/kyc/initiate', { aadhaarNumber: '123412341234' }, tok);
    await call('kyc confirm ' + tag, 'POST', '/api/kyc/confirm', { referenceId: find(ini, 'referenceId'), otp: '123456' }, tok);
    const pend = await call('pending sellers ' + tag, 'GET', '/api/admin/sellers/pending', null, aTok);
    const me = (pend.data || []).find((x) => x.phone === phone);
    if (!me) { console.log('>>> seller not found in pending'); process.exit(1); }
    await call('approve seller ' + tag, 'PATCH', `/api/admin/sellers/${me.id}/approve`, { approve: true }, aTok);
    return { tok, sellerId: me.id, phone };
  }

  const S = await makeSeller('S1');
  const bReg = await call('register buyer', 'POST', '/api/auth/register', { fullName: 'Pay Buyer ' + rnd(), phone: '8' + rnd() + '2', password: PW, role: 'buyer' });
  const bTok = find(bReg, 'accessToken');
  const bId = find(bReg, 'id');
  const b2Reg = await call('register buyer2', 'POST', '/api/auth/register', { fullName: 'Pay Buyer2 ' + rnd(), phone: '8' + rnd() + '3', password: PW, role: 'buyer' });
  const b2Tok = find(b2Reg, 'accessToken');
  const dReg = await call('register rider', 'POST', '/api/auth/register', { fullName: 'Pay Rider ' + rnd(), phone: '7' + rnd() + '4', password: PW, role: 'delivery_partner' });
  const dTok = find(dReg, 'accessToken');

  // Create product
  const oemPart = 'PAY-BD-' + rnd();
  const prod = await call('create product', 'POST', '/api/products', { name: 'Brake Disc (PAY-E2E)', oemPartNumber: oemPart, brand: 'TestB', category: 'brakes', pricePaise: 500000, stockQuantity: 20 }, S.tok, 201);
  const productId = find(prod, 'id');

  async function getStock() {
    const sr = await call('search product stock', 'GET', `/api/products/search?oemPartNumber=${oemPart}`, null, null);
    const p = (sr.data || []).find(x => x.id === productId);
    return p ? Number(p.stock_quantity) : null;
  }

  // ============================================================
  console.log('\n--- 1. Payment row created pending with total+service fee ---');
  // ============================================================
  const ord1 = await call('order (cod)', 'POST', '/api/orders', { productId, quantity: 2, deliveryAddress: '42 Test Lane, Delhi' }, bTok, 201);
  const orderId1 = find(ord1, 'id');
  const myOrders = await call('my orders', 'GET', '/api/orders/my', null, bTok);
  // Check payment via internal API
  const ctx1 = await call('internal context for payment check', 'GET', `/api/internal/customers/${bId}/context`, null, null, 200, { 'x-internal-api-key': INTERNAL_API_KEY });
  const pay1 = (ctx1.data?.payments || []).find(p => p.orderId === orderId1);
  check('payment exists with pending status', pay1 && pay1.status === 'pending', pay1);
  // total = 500000*2 = 1000000, service_fee = 0 -> payment = 1000000 paise = 10000 rupees
  check('payment amount = (total + service fee) / 100 = 10000', pay1 && pay1.amount === 10000, pay1);
  check('payment rawStatus = pending', pay1 && pay1.rawStatus === 'pending', pay1);
  check('payment method = cod', pay1 && pay1.method === 'cod', pay1);

  // ============================================================
  console.log('\n--- 2. Online payment -> 501 ---');
  // ============================================================
  const onlineOrd = await call('order (online) -> 501', 'POST', '/api/orders', { productId, quantity: 1, deliveryAddress: '42 Test Lane, Delhi', paymentMethod: 'online' }, bTok, 501);
  check('online error message', onlineOrd && onlineOrd.error && onlineOrd.error.includes('not available'), onlineOrd);

  // ============================================================
  console.log('\n--- 3. Delivered -> payment succeeded + delivered_at set ---');
  // ============================================================
  await call('seller accepts ord1', 'PATCH', `/api/orders/${orderId1}/status`, { status: 'accepted_by_seller' }, S.tok);
  await call('rider claims ord1', 'PATCH', `/api/delivery/${orderId1}/claim`, null, dTok);
  await call('out_for_delivery ord1', 'PATCH', `/api/delivery/${orderId1}/status`, { status: 'out_for_delivery' }, dTok);
  await call('delivered ord1', 'PATCH', `/api/delivery/${orderId1}/status`, { status: 'delivered' }, dTok);

  const ctx2 = await call('internal context after delivery', 'GET', `/api/internal/customers/${bId}/context`, null, null, 200, { 'x-internal-api-key': INTERNAL_API_KEY });
  const pay2 = (ctx2.data?.payments || []).find(p => p.orderId === orderId1);
  check('payment status -> success after delivered', pay2 && pay2.status === 'success', pay2);
  check('payment rawStatus -> succeeded', pay2 && pay2.rawStatus === 'succeeded', pay2);
  check('payment collectedAt set', pay2 && pay2.collectedAt !== null, pay2);
  const deliveredOrder = (ctx2.data?.orders || []).find(o => o.id === orderId1);
  check('order deliveredAt set', deliveredOrder && deliveredOrder.deliveredAt !== null, deliveredOrder);

  // ============================================================
  console.log('\n--- 4. Seller reject -> payment cancelled ---');
  // ============================================================
  const ord2 = await call('order2 for rejection', 'POST', '/api/orders', { productId, quantity: 1, deliveryAddress: '99 Reject Road' }, bTok, 201);
  const orderId2 = find(ord2, 'id');
  await call('seller rejects ord2', 'PATCH', `/api/orders/${orderId2}/status`, { status: 'rejected_by_seller' }, S.tok);
  const ctx3 = await call('internal context after rejection', 'GET', `/api/internal/customers/${bId}/context`, null, null, 200, { 'x-internal-api-key': INTERNAL_API_KEY });
  const pay3 = (ctx3.data?.payments || []).find(p => p.orderId === orderId2);
  check('rejected order payment -> failed', pay3 && pay3.status === 'failed', pay3);

  // ============================================================
  console.log('\n--- 5. Buyer cancel in placed restores stock ---');
  // ============================================================
  const stockBefore = await getStock();

  const ord3 = await call('order3 for cancel', 'POST', '/api/orders', { productId, quantity: 3, deliveryAddress: '55 Cancel Ave' }, bTok, 201);
  const orderId3 = find(ord3, 'id');
  const stockAfterOrder = await getStock();
  check('stock decreased by 3', stockAfterOrder === stockBefore - 3, { stockBefore, stockAfterOrder });

  await call('buyer cancel ord3', 'POST', `/api/orders/${orderId3}/cancel`, { reason: 'Changed my mind' }, bTok);
  const stockAfterCancel = await getStock();
  check('stock restored after cancel', stockAfterCancel === stockBefore, { stockBefore, stockAfterCancel });

  // ============================================================
  console.log('\n--- 6. Cancel after out_for_delivery -> 409 ---');
  // ============================================================
  const ord4 = await call('order4 for out_for_delivery', 'POST', '/api/orders', { productId, quantity: 1, deliveryAddress: '66 Delivery Rd' }, bTok, 201);
  const orderId4 = find(ord4, 'id');
  await call('seller accepts ord4', 'PATCH', `/api/orders/${orderId4}/status`, { status: 'accepted_by_seller' }, S.tok);
  await call('rider claims ord4', 'PATCH', `/api/delivery/${orderId4}/claim`, null, dTok);
  await call('out_for_delivery ord4', 'PATCH', `/api/delivery/${orderId4}/status`, { status: 'out_for_delivery' }, dTok);
  await call('cancel after out_for_delivery -> 409', 'POST', `/api/orders/${orderId4}/cancel`, {}, bTok, 409);

  // ============================================================
  console.log('\n--- 7. Other buyer cancel/return -> 404 ---');
  // ============================================================
  await call('buyer2 cancel buyer1 order -> 404', 'POST', `/api/orders/${orderId3}/cancel`, {}, b2Tok, 404);
  await call('buyer2 return buyer1 order -> 404', 'POST', `/api/orders/${orderId1}/return`, { reason: 'Not my order' }, b2Tok, 404);

  // ============================================================
  console.log('\n--- 8. Return before delivered -> 409 ---');
  // ============================================================
  // ord4 is out_for_delivery
  await call('return before delivered -> 409', 'POST', `/api/orders/${orderId4}/return`, { reason: 'Too early' }, bTok, 409);

  // ============================================================
  console.log('\n--- 9. Return window expired -> 400 ---');
  // ============================================================
  // Backdate delivered_at on ord1 so window expires
  await directSql(`UPDATE orders SET delivered_at = now() - interval '30 days' WHERE id = '${orderId1}'`);
  await call('return after window expired -> 400', 'POST', `/api/orders/${orderId1}/return`, { reason: 'Too late return' }, bTok, 400);
  // Restore delivered_at so we can test further
  await directSql(`UPDATE orders SET delivered_at = now() WHERE id = '${orderId1}'`);

  // ============================================================
  console.log('\n--- 10. Return request + second active return -> 409 ---');
  // ============================================================
  const ret1 = await call('create return request', 'POST', `/api/orders/${orderId1}/return`, { reason: 'Part is defective and does not fit' }, bTok, 201);
  const returnId1 = find(ret1, 'id');
  check('return created', returnId1 !== undefined, ret1);
  await call('second active return -> 409', 'POST', `/api/orders/${orderId1}/return`, { reason: 'Trying again' }, bTok, 409);

  // ============================================================
  console.log('\n--- 11. Seller review/received -> order returned ---');
  // ============================================================
  await call('seller approves return', 'PATCH', `/api/returns/${returnId1}/review`, { decision: 'approved', note: 'Approved for return' }, S.tok);
  await call('seller marks received', 'PATCH', `/api/returns/${returnId1}/received`, null, S.tok);

  const ctx4 = await call('internal context after return received', 'GET', `/api/internal/customers/${bId}/context`, null, null, 200, { 'x-internal-api-key': INTERNAL_API_KEY });
  const retOrder = (ctx4.data?.orders || []).find(o => o.id === orderId1);
  check('order status -> returned', retOrder && retOrder.status === 'returned', retOrder);

  // ============================================================
  console.log('\n--- 12. Non-admin refund -> 403 ---');
  // ============================================================
  const idemKey1 = 'idem-' + rnd() + '-' + rnd();
  await call('buyer creates refund -> 403', 'POST', '/api/admin/refunds', { orderId: orderId1, amountPaise: 100000, reason: 'gimme money' }, bTok, 403, { 'Idempotency-Key': idemKey1 });
  await call('seller creates refund -> 403', 'POST', '/api/admin/refunds', { orderId: orderId1, amountPaise: 100000, reason: 'gimme money' }, S.tok, 403, { 'Idempotency-Key': idemKey1 });

  // ============================================================
  console.log('\n--- 13. Refund without Idempotency-Key -> 400 ---');
  // ============================================================
  await call('refund without idempotency key -> 400', 'POST', '/api/admin/refunds', { orderId: orderId1, amountPaise: 100000, reason: 'no key' }, aTok, 400);

  // ============================================================
  console.log('\n--- 14. Refund > payment -> 400 ---');
  // ============================================================
  const bigKey = 'bigrefund-' + rnd();
  await call('refund > payment amount -> 400', 'POST', '/api/admin/refunds', { orderId: orderId1, amountPaise: 999999999, reason: 'too much' }, aTok, 400, { 'Idempotency-Key': bigKey });

  // ============================================================
  console.log('\n--- 15. Idempotent replay returns same refund ---');
  // ============================================================
  const idemKey2 = 'replay-' + rnd() + '-' + rnd();
  const refund1 = await call('create refund (first)', 'POST', '/api/admin/refunds', { orderId: orderId1, amountPaise: 200000, reason: 'partial refund test' }, aTok, 201, { 'Idempotency-Key': idemKey2 });
  const refundId1 = find(refund1, 'id');
  const refund1b = await call('idempotent replay (same key+payload)', 'POST', '/api/admin/refunds', { orderId: orderId1, amountPaise: 200000, reason: 'partial refund test' }, aTok, 200, { 'Idempotency-Key': idemKey2 });
  const refundId1b = find(refund1b, 'id');
  check('idempotent replay returns same id', refundId1 === refundId1b, { refundId1, refundId1b });

  // ============================================================
  console.log('\n--- 16. 5 parallel refunds whose sum exceeds payment -> total never exceeds ---');
  // ============================================================
  // Payment for orderId1 is 1000000 paise (10000 rupees). Already refunded 200000.
  // Remaining: 800000. Fire 5 x 300000 = 1500000 in parallel.
  const parallelKeys = Array.from({ length: 5 }, (_, i) => `par-${rnd()}-${i}`);
  const parallelResults = await Promise.all(
    parallelKeys.map(key =>
      call(`parallel refund ${key}`, 'POST', '/api/admin/refunds',
        { orderId: orderId1, amountPaise: 300000, reason: 'parallel test' },
        aTok, [201, 400, 409], { 'Idempotency-Key': key })
    )
  );
  const successCount = parallelResults.filter(r => r.success === true && find(r, 'id')).length;
  // Max 2 can succeed (2*300000=600000 <= 800000; 3*300000=900000 > 800000)
  check('parallel: at most 2 refunds succeed (600k <= 800k remaining)', successCount <= 2, { successCount });
  check('parallel: at least 1 refund succeeded', successCount >= 1, { successCount });

  // ============================================================
  console.log('\n--- 17. Process refund -> payment partially_refunded/refunded ---');
  // ============================================================
  // Process the first refund we created
  const proc1 = await call('process refund -> processed', 'PATCH', `/api/admin/refunds/${refundId1}/process`, { status: 'processed', note: 'Manual COD refund done' }, aTok);
  check('refund processed', proc1.success === true, proc1);

  const ctx5 = await call('context after processing refund', 'GET', `/api/internal/customers/${bId}/context`, null, null, 200, { 'x-internal-api-key': INTERNAL_API_KEY });
  const payAfter = (ctx5.data?.payments || []).find(p => p.orderId === orderId1);
  // We only processed 200000 out of 1000000. More pending refunds may exist.
  check('payment rawStatus is partially_refunded or refunded', payAfter && ['partially_refunded', 'refunded'].includes(payAfter.rawStatus), payAfter);

  // Process all remaining pending refunds to see if full refund works
  const allRefunds = await call('list admin refunds', 'GET', `/api/admin/refunds?orderId=${orderId1}`, null, aTok);
  const pendingRefunds = (allRefunds.data || []).filter(r => r.status === 'pending');
  for (const pr of pendingRefunds) {
    await call(`process pending refund ${pr.id}`, 'PATCH', `/api/admin/refunds/${pr.id}/process`, { status: 'processed', note: 'batch process' }, aTok);
  }

  // ============================================================
  console.log('\n--- 18. Internal API: real payments/refunds/returnRequests/statusHistory, no securityEvents ---');
  // ============================================================
  const ctx6 = await call('full internal context', 'GET', `/api/internal/customers/${bId}/context`, null, null, 200, { 'x-internal-api-key': INTERNAL_API_KEY });
  const d = ctx6.data || {};
  check('has customer', d.customer && d.customer.id === bId, d.customer);
  check('has orders array', Array.isArray(d.orders), d);
  check('has payments array', Array.isArray(d.payments), d);
  check('has refunds array', Array.isArray(d.refunds), d);
  check('has returnRequests array', Array.isArray(d.returnRequests), d);
  check('NO securityEvents key', !('securityEvents' in d), Object.keys(d));

  const someOrder = (d.orders || []).find(o => o.id === orderId1);
  check('order has statusHistory array', someOrder && Array.isArray(someOrder.statusHistory), someOrder);
  check('order has expectedDeliveryBy', someOrder && someOrder.expectedDeliveryBy, someOrder);
  check('order has cancelReason field', someOrder && 'cancelReason' in someOrder, someOrder);

  const somePayment = (d.payments || []).find(p => p.orderId === orderId1);
  check('payment has rawStatus', somePayment && somePayment.rawStatus !== undefined, somePayment);
  check('payment has method', somePayment && somePayment.method === 'cod', somePayment);

  const someRefund = (d.refunds || []).find(r => r.id === refundId1);
  check('refund has initiatedAt', someRefund && someRefund.initiatedAt !== undefined, someRefund);
  check('refund amount is in rupees', someRefund && someRefund.amount === 2000, someRefund);

  const someReturn = (d.returnRequests || []).find(r => r.orderId === orderId1);
  check('returnRequest present', someReturn !== undefined, d.returnRequests);

  // ============================================================
  console.log('\n--- 19. Internal API without key -> 401/403 ---');
  // ============================================================
  await call('internal without key -> 401', 'GET', `/api/internal/customers/${bId}/context`, null, null, [401, 403]);

  // ============================================================
  console.log('\n--- 20. GET /api/returns ---');
  // ============================================================
  const buyerReturns = await call('buyer list returns', 'GET', '/api/returns', null, bTok);
  check('buyer sees returns', Array.isArray(buyerReturns.data) && buyerReturns.data.length > 0, buyerReturns);
  const sellerReturns = await call('seller list returns', 'GET', '/api/returns', null, S.tok);
  check('seller sees returns', Array.isArray(sellerReturns.data), sellerReturns);

  // ============================================================
  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
  process.exit(fails ? 1 : 0);
})();
