/**
 * Regression test suite for Payments / Returns / Refunds bug fixes (Items 1-7).
 */
require('dotenv').config();
const { Client } = require('pg');

const SR = 'http://localhost:4000';
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const PW = 'Test@12345678';
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE || '9000000001';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin@12345678';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '8e1451e4ef36038c750e04ac930f69fc53f46686f6e17ace733142f83bdf9977';

const find = (o, k) => {
  if (o && typeof o === 'object') {
    if (k in o && o[k] != null) return o[k];
    for (const v of Object.values(o)) {
      const r = find(v, k);
      if (r != null) return r;
    }
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
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  const ok = [].concat(expect).includes(res.status);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${res.status}] ${label}`);
  if (!ok || process.env.VERBOSE) {
    console.log('    ', JSON.stringify(json).replace(/(\"(?:accessToken|refreshToken)\":\")[^\"]+/g, '$1***').slice(0, 800));
  }
  return json;
}

function check(label, cond, extra) {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}       ${label}${cond ? '' : '  -> ' + JSON.stringify(extra).slice(0, 300)}`);
}

async function queryDb(sql, params = []) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    await client.end();
  }
}

(async () => {
  console.log('\n====== PAYMENTS FIXES REGRESSION E2E ======\n');

  // --- Auth Setup ---
  const aLogin = await call('admin login', 'POST', '/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD });
  const aTok = find(aLogin, 'accessToken');

  async function makeSeller(tag) {
    const phone = '9' + rnd() + '1';
    const reg = await call('register seller ' + tag, 'POST', '/api/auth/register', {
      fullName: 'Fixes Seller ' + tag + ' ' + rnd(),
      phone,
      password: PW,
      role: 'seller',
    });
    const tok = find(reg, 'accessToken');
    const ini = await call('kyc initiate ' + tag, 'POST', '/api/kyc/initiate', { aadhaarNumber: '123412341234' }, tok);
    await call('kyc confirm ' + tag, 'POST', '/api/kyc/confirm', { referenceId: find(ini, 'referenceId'), otp: '123456' }, tok);
    const pend = await call('pending sellers ' + tag, 'GET', '/api/admin/sellers/pending', null, aTok);
    const me = (pend.data || []).find((x) => x.phone === phone);
    if (!me) {
      console.log('>>> seller not found in pending');
      process.exit(1);
    }
    await call('approve seller ' + tag, 'PATCH', `/api/admin/sellers/${me.id}/approve`, { approve: true }, aTok);
    return { tok, sellerId: me.id, phone };
  }

  const S = await makeSeller('S1');
  const bReg = await call('register buyer', 'POST', '/api/auth/register', {
    fullName: 'Fixes Buyer ' + rnd(),
    phone: '8' + rnd() + '2',
    password: PW,
    role: 'buyer',
  });
  const bTok = find(bReg, 'accessToken');
  const bId = find(bReg, 'id');

  const dReg = await call('register rider', 'POST', '/api/auth/register', {
    fullName: 'Fixes Rider ' + rnd(),
    phone: '7' + rnd() + '4',
    password: PW,
    role: 'delivery_partner',
  });
  const dTok = find(dReg, 'accessToken');

  // ============================================================
  console.log('\n--- ITEM 1: MONEY ARITHMETIC WITH MECHANIC FEE ---');
  // ============================================================
  // Test: a 250000 product with a mechanic whose fee is 30000 => payments.amount_paise = 280000 and orders.total_amount_paise = 250000 (verify via the API/DB).
  const oemPart = 'FIX-MECH-' + rnd();
  const prod1 = await call('create 250000 product', 'POST', '/api/products', {
    name: 'Clutch Disc ' + rnd(),
    oemPartNumber: oemPart,
    brand: 'FixBrand',
    category: 'clutch',
    pricePaise: 250000,
    stockQuantity: 10,
  }, S.tok, 201);
  const productId1 = find(prod1, 'id');

  const mechRes = await call('create mechanic (fee 30000)', 'POST', '/api/mechanics', {
    name: 'Master Mech ' + rnd(),
    phone: '9' + rnd() + '9',
    serviceFeePaise: 30000,
  }, S.tok, 201);
  const mechId = find(mechRes, 'id');

  const ord1 = await call('order with 250000 product + 30000 mechanic', 'POST', '/api/orders', {
    productId: productId1,
    quantity: 1,
    deliveryAddress: '100 Arithmetic Highway',
    mechanicId: mechId,
  }, bTok, 201);
  const orderId1 = find(ord1, 'id');

  // Check via DB
  const dbRows = await queryDb(
    'SELECT o.total_amount_paise, o.service_fee_paise, p.amount_paise FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.id = $1',
    [orderId1]
  );
  check('orders.total_amount_paise == 250000', dbRows[0] && String(dbRows[0].total_amount_paise) === '250000', dbRows[0]);
  check('orders.service_fee_paise == 30000', dbRows[0] && String(dbRows[0].service_fee_paise) === '30000', dbRows[0]);
  check('payments.amount_paise == 280000 (not 25000030000)', dbRows[0] && String(dbRows[0].amount_paise) === '280000', dbRows[0]);

  // Check via internal context API
  const ctx = await call('internal context verification', 'GET', `/api/internal/customers/${bId}/context`, null, null, 200, { 'x-internal-api-key': INTERNAL_API_KEY });
  const pCheck = (ctx.data?.payments || []).find((p) => p.orderId === orderId1);
  check('API payment amount in rupees == 2800', pCheck && pCheck.amount === 2800, pCheck);

  // ============================================================
  console.log('\n--- ITEM 2: SELLER STATUS UPDATE GUARDS & STOCK RESTORATION ---');
  // ============================================================
  async function getStock(pId) {
    const res = await queryDb('SELECT stock_quantity FROM products WHERE id = $1', [pId]);
    return Number(res[0]?.stock_quantity);
  }

  // 1. Stock restored on seller reject
  const prod2 = await call('create product for reject/cancel tests', 'POST', '/api/products', {
    name: 'Brake Pad ' + rnd(),
    oemPartNumber: 'FIX-BP-' + rnd(),
    brand: 'FixBrand',
    category: 'brakes',
    pricePaise: 100000,
    stockQuantity: 10,
  }, S.tok, 201);
  const pId2 = find(prod2, 'id');

  const ordReject = await call('place order for reject', 'POST', '/api/orders', {
    productId: pId2,
    quantity: 2,
    deliveryAddress: '200 Reject Blvd',
  }, bTok, 201);
  const ordRejectId = find(ordReject, 'id');
  check('stock decremented by 2 to 8', (await getStock(pId2)) === 8);

  await call('seller rejects placed order', 'PATCH', `/api/orders/${ordRejectId}/status`, { status: 'rejected_by_seller' }, S.tok, 200);
  check('stock restored to 10 on seller reject', (await getStock(pId2)) === 10);
  const payReject = await queryDb('SELECT status FROM payments WHERE order_id = $1', [ordRejectId]);
  check('payment cancelled on seller reject', payReject[0]?.status === 'cancelled', payReject);

  // 2. Stock restored on seller cancel
  const ordCancel = await call('place order for cancel', 'POST', '/api/orders', {
    productId: pId2,
    quantity: 3,
    deliveryAddress: '300 Cancel Blvd',
  }, bTok, 201);
  const ordCancelId = find(ordCancel, 'id');
  check('stock decremented to 7', (await getStock(pId2)) === 7);

  await call('seller accepts order', 'PATCH', `/api/orders/${ordCancelId}/status`, { status: 'accepted_by_seller' }, S.tok, 200);
  await call('seller cancels accepted order', 'PATCH', `/api/orders/${ordCancelId}/status`, { status: 'cancelled' }, S.tok, 200);
  check('stock restored to 10 on seller cancel', (await getStock(pId2)) === 10);
  const payCancel = await queryDb('SELECT status FROM payments WHERE order_id = $1', [ordCancelId]);
  check('payment cancelled on seller cancel', payCancel[0]?.status === 'cancelled', payCancel);

  // 3. Cancelled order cannot be resurrected
  await call('seller resurrect cancel -> 409', 'PATCH', `/api/orders/${ordCancelId}/status`, { status: 'accepted_by_seller' }, S.tok, 409);
  await call('seller reject cancelled order -> 409', 'PATCH', `/api/orders/${ordCancelId}/status`, { status: 'rejected_by_seller' }, S.tok, 409);
  await call('seller re-cancel cancelled order -> 409', 'PATCH', `/api/orders/${ordCancelId}/status`, { status: 'cancelled' }, S.tok, 409);

  // 4. Seller cannot cancel/reject/accept an out_for_delivery, delivered, or returned order
  const ordDeliv = await call('place order for delivery transitions', 'POST', '/api/orders', {
    productId: pId2,
    quantity: 1,
    deliveryAddress: '400 Transit Way',
  }, bTok, 201);
  const ordDelivId = find(ordDeliv, 'id');
  await call('seller accepts ordDeliv', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'accepted_by_seller' }, S.tok, 200);
  await call('rider claims ordDeliv', 'PATCH', `/api/delivery/${ordDelivId}/claim`, null, dTok, 200);

  // Try seller cancel when delivery_partner_id is NOT null -> 409!
  await call('seller cancel when claimed by rider -> 409', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'cancelled' }, S.tok, 409);

  await call('rider marks out_for_delivery', 'PATCH', `/api/delivery/${ordDelivId}/status`, { status: 'out_for_delivery' }, dTok, 200);

  // out_for_delivery: seller cannot accept, reject, or cancel
  await call('seller accept out_for_delivery -> 409', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'accepted_by_seller' }, S.tok, 409);
  await call('seller reject out_for_delivery -> 409', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'rejected_by_seller' }, S.tok, 409);
  await call('seller cancel out_for_delivery -> 409', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'cancelled' }, S.tok, 409);

  // Move to delivered
  await call('rider marks delivered', 'PATCH', `/api/delivery/${ordDelivId}/status`, { status: 'delivered' }, dTok, 200);
  const payDeliveredBefore = await queryDb('SELECT status FROM payments WHERE order_id = $1', [ordDelivId]);
  check('delivered payment is succeeded', payDeliveredBefore[0]?.status === 'succeeded', payDeliveredBefore);

  // delivered: seller cannot accept, reject, or cancel
  await call('seller accept delivered -> 409', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'accepted_by_seller' }, S.tok, 409);
  await call('seller reject delivered -> 409', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'rejected_by_seller' }, S.tok, 409);
  await call('seller cancel delivered -> 409', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'cancelled' }, S.tok, 409);

  const payDeliveredAfter = await queryDb('SELECT status FROM payments WHERE order_id = $1', [ordDelivId]);
  check("delivered order's payment stays succeeded", payDeliveredAfter[0]?.status === 'succeeded', payDeliveredAfter);

  // Move to returned: return request -> seller approves -> seller marks received -> order status: returned
  const retReq = await call('buyer requests return', 'POST', `/api/orders/${ordDelivId}/return`, { reason: 'Defective product received' }, bTok, 201);
  const retReqId = find(retReq, 'id');
  await call('seller approves return', 'PATCH', `/api/returns/${retReqId}/review`, { decision: 'approved' }, S.tok, 200);
  await call('seller marks received', 'PATCH', `/api/returns/${retReqId}/received`, null, S.tok, 200);

  // returned: seller cannot accept, reject, or cancel
  await call('seller accept returned order -> 409', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'accepted_by_seller' }, S.tok, 409);
  await call('seller reject returned order -> 409', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'rejected_by_seller' }, S.tok, 409);
  await call('seller cancel returned order -> 409', 'PATCH', `/api/orders/${ordDelivId}/status`, { status: 'cancelled' }, S.tok, 409);

  // ============================================================
  console.log('\n--- ITEM 3: DELIVERY BYPASS PREVENTION ---');
  // ============================================================
  // Test: a delivery partner cannot set 'returned'
  const ordBypass = await call('place order for bypass test', 'POST', '/api/orders', {
    productId: pId2,
    quantity: 1,
    deliveryAddress: '500 Bypass Ave',
  }, bTok, 201);
  const ordBypassId = find(ordBypass, 'id');
  await call('seller accepts ordBypass', 'PATCH', `/api/orders/${ordBypassId}/status`, { status: 'accepted_by_seller' }, S.tok, 200);
  await call('rider claims ordBypass', 'PATCH', `/api/delivery/${ordBypassId}/claim`, null, dTok, 200);
  await call('rider marks out_for_delivery', 'PATCH', `/api/delivery/${ordBypassId}/status`, { status: 'out_for_delivery' }, dTok, 200);
  await call('rider marks delivered', 'PATCH', `/api/delivery/${ordBypassId}/status`, { status: 'delivered' }, dTok, 200);

  // Delivery partner tries to set 'returned' -> must fail (400)
  await call('rider cannot set returned -> 400', 'PATCH', `/api/delivery/${ordBypassId}/status`, { status: 'returned' }, dTok, 400);

  const orderAfterBypass = await queryDb('SELECT status FROM orders WHERE id = $1', [ordBypassId]);
  check("order remains 'delivered' after bypass attempt", orderAfterBypass[0]?.status === 'delivered', orderAfterBypass);

  // ============================================================
  console.log('\n--- ITEM 4: ADMIN PARTIAL REFUNDS SEQUENTIAL PROCESSING ---');
  // ============================================================
  // Test: two sequential partial refunds both processed => payment ends 'refunded' when the sum equals the payment amount; a third refund is rejected.
  const prod4 = await call('create product for refund test', 'POST', '/api/products', {
    name: 'Suspension Arm ' + rnd(),
    oemPartNumber: 'FIX-REF-' + rnd(),
    brand: 'FixBrand',
    category: 'suspension',
    pricePaise: 100000, // 1000 INR
    stockQuantity: 10,
  }, S.tok, 201);
  const pId4 = find(prod4, 'id');

  const ordRefund = await call('place order for refund test', 'POST', '/api/orders', {
    productId: pId4,
    quantity: 1,
    deliveryAddress: '600 Refund Lane',
  }, bTok, 201);
  const ordRefundId = find(ordRefund, 'id');

  await call('seller accepts ordRefund', 'PATCH', `/api/orders/${ordRefundId}/status`, { status: 'accepted_by_seller' }, S.tok, 200);
  await call('rider claims ordRefund', 'PATCH', `/api/delivery/${ordRefundId}/claim`, null, dTok, 200);
  await call('rider marks out_for_delivery', 'PATCH', `/api/delivery/${ordRefundId}/status`, { status: 'out_for_delivery' }, dTok, 200);
  await call('rider marks delivered', 'PATCH', `/api/delivery/${ordRefundId}/status`, { status: 'delivered' }, dTok, 200);

  // Schema cap test: amountPaise > 1000000000 should be rejected by Zod (400)
  const hugeKey = 'huge-' + rnd() + '-' + rnd();
  await call('refund amount exceeds schema cap 1000000000 -> 400', 'POST', '/api/admin/refunds', {
    orderId: ordRefundId,
    amountPaise: 1000000001,
    reason: 'too huge',
  }, aTok, 400, { 'Idempotency-Key': hugeKey });

  // First partial refund: 40000 paise
  const key1 = 'ref1-' + rnd() + '-' + rnd();
  const ref1 = await call('create first partial refund (40000 paise)', 'POST', '/api/admin/refunds', {
    orderId: ordRefundId,
    amountPaise: 40000,
    reason: 'First partial refund',
  }, aTok, 201, { 'Idempotency-Key': key1 });
  const ref1Id = find(ref1, 'id');

  // Process first partial refund
  await call('process first partial refund', 'PATCH', `/api/admin/refunds/${ref1Id}/process`, {
    status: 'processed',
    note: 'First partial refund processed',
  }, aTok, 200);

  const payAfter1 = await queryDb('SELECT status FROM payments WHERE order_id = $1', [ordRefundId]);
  check("payment status is partially_refunded after 1st refund", payAfter1[0]?.status === 'partially_refunded', payAfter1);

  // Second partial refund: 60000 paise (sum = 100000, equals total payment amount)
  // Under the old code, this failed with 409 because payment status was 'partially_refunded' not 'succeeded'
  const key2 = 'ref2-' + rnd() + '-' + rnd();
  const ref2 = await call('create second partial refund (60000 paise)', 'POST', '/api/admin/refunds', {
    orderId: ordRefundId,
    amountPaise: 60000,
    reason: 'Second partial refund',
  }, aTok, 201, { 'Idempotency-Key': key2 });
  const ref2Id = find(ref2, 'id');

  // Process second partial refund
  await call('process second partial refund', 'PATCH', `/api/admin/refunds/${ref2Id}/process`, {
    status: 'processed',
    note: 'Second partial refund processed',
  }, aTok, 200);

  const payAfter2 = await queryDb('SELECT status FROM payments WHERE order_id = $1', [ordRefundId]);
  check("payment ends 'refunded' when sum equals payment amount", payAfter2[0]?.status === 'refunded', payAfter2);

  // Third refund attempt: must be rejected (409 because payment is 'refunded')
  const key3 = 'ref3-' + rnd() + '-' + rnd();
  await call('third refund rejected when payment already refunded -> 409', 'POST', '/api/admin/refunds', {
    orderId: ordRefundId,
    amountPaise: 10000,
    reason: 'Third refund should fail',
  }, aTok, [400, 409], { 'Idempotency-Key': key3 });

  // ============================================================
  console.log('\n--- ITEM 5: MIGRATION 004 ON DELETE RESTRICT ---');
  // ============================================================
  // Test: deleting an order that has a payment via SQL is rejected (clean up only the rows the test created).
  const prod5 = await call('create product for delete restrict test', 'POST', '/api/products', {
    name: 'Spark Plug ' + rnd(),
    oemPartNumber: 'FIX-SP-' + rnd(),
    brand: 'FixBrand',
    category: 'ignition',
    pricePaise: 50000,
    stockQuantity: 10,
  }, S.tok, 201);
  const pId5 = find(prod5, 'id');

  const ordDelete = await call('place order for delete test', 'POST', '/api/orders', {
    productId: pId5,
    quantity: 1,
    deliveryAddress: '700 Delete Restrict Ave',
  }, bTok, 201);
  const ordDeleteId = find(ordDelete, 'id');

  let deleteRejected = false;
  let deleteError = null;
  try {
    await queryDb('DELETE FROM orders WHERE id = $1', [ordDeleteId]);
  } catch (err) {
    deleteRejected = true;
    deleteError = err.message;
  }
  check('deleting order with payment via SQL is rejected (ON DELETE RESTRICT)', deleteRejected, { deleteError });

  // Clean up only the rows the test created
  await queryDb('DELETE FROM payments WHERE order_id = $1', [ordDeleteId]);
  await queryDb('DELETE FROM order_status_history WHERE order_id = $1', [ordDeleteId]);
  await queryDb('DELETE FROM order_items WHERE order_id = $1', [ordDeleteId]);
  await queryDb('DELETE FROM orders WHERE id = $1', [ordDeleteId]);
  await queryDb('DELETE FROM products WHERE id = $1', [pId5]);

  const ordCheckAfterCleanup = await queryDb('SELECT id FROM orders WHERE id = $1', [ordDeleteId]);
  check('test order cleaned up', ordCheckAfterCleanup.length === 0);

  // ============================================================
  console.log('\n--- ITEM 6: LOCK ORDERING (NO DEADLOCKS) ---');
  // ============================================================
  // Test: 10 concurrent requestReturn/markReceived/reviewReturn calls never produce an HTTP 500.
  const prod6 = await call('create product for deadlock test', 'POST', '/api/products', {
    name: 'Wiper Motor ' + rnd(),
    oemPartNumber: 'FIX-LOCK-' + rnd(),
    brand: 'FixBrand',
    category: 'electrical',
    pricePaise: 80000,
    stockQuantity: 10,
  }, S.tok, 201);
  const pId6 = find(prod6, 'id');

  const ordLock = await call('place order for deadlock test', 'POST', '/api/orders', {
    productId: pId6,
    quantity: 1,
    deliveryAddress: '800 Concurrency Court',
  }, bTok, 201);
  const ordLockId = find(ordLock, 'id');

  await call('seller accepts ordLock', 'PATCH', `/api/orders/${ordLockId}/status`, { status: 'accepted_by_seller' }, S.tok, 200);
  await call('rider claims ordLock', 'PATCH', `/api/delivery/${ordLockId}/claim`, null, dTok, 200);
  await call('rider marks out_for_delivery', 'PATCH', `/api/delivery/${ordLockId}/status`, { status: 'out_for_delivery' }, dTok, 200);
  await call('rider marks delivered', 'PATCH', `/api/delivery/${ordLockId}/status`, { status: 'delivered' }, dTok, 200);

  // Create an initial return request
  const retLock = await call('create return request for concurrency', 'POST', `/api/orders/${ordLockId}/return`, {
    reason: 'Initial return request for lock test',
  }, bTok, 201);
  const retLockId = find(retLock, 'id');

  // Fire 10 concurrent requests mixing requestReturn, reviewReturn, and markReceived (none must be 500)
  const concurrentCalls = [
    call('concurrent 1: review approved', 'PATCH', `/api/returns/${retLockId}/review`, { decision: 'approved' }, S.tok, [200, 400, 404, 409]),
    call('concurrent 2: mark received', 'PATCH', `/api/returns/${retLockId}/received`, null, S.tok, [200, 400, 404, 409]),
    call('concurrent 3: request return again', 'POST', `/api/orders/${ordLockId}/return`, { reason: 'Duplicate attempt 1' }, bTok, [201, 400, 409]),
    call('concurrent 4: review rejected', 'PATCH', `/api/returns/${retLockId}/review`, { decision: 'rejected' }, S.tok, [200, 400, 404, 409]),
    call('concurrent 5: mark received again', 'PATCH', `/api/returns/${retLockId}/received`, null, S.tok, [200, 400, 404, 409]),
    call('concurrent 6: request return again', 'POST', `/api/orders/${ordLockId}/return`, { reason: 'Duplicate attempt 2' }, bTok, [201, 400, 409]),
    call('concurrent 7: review approved', 'PATCH', `/api/returns/${retLockId}/review`, { decision: 'approved' }, S.tok, [200, 400, 404, 409]),
    call('concurrent 8: mark received', 'PATCH', `/api/returns/${retLockId}/received`, null, S.tok, [200, 400, 404, 409]),
    call('concurrent 9: request return again', 'POST', `/api/orders/${ordLockId}/return`, { reason: 'Duplicate attempt 3' }, bTok, [201, 400, 409]),
    call('concurrent 10: review approved', 'PATCH', `/api/returns/${retLockId}/review`, { decision: 'approved' }, S.tok, [200, 400, 404, 409]),
  ];

  const concurrentResults = await Promise.all(concurrentCalls);
  check('10 concurrent calls completed without deadlock HTTP 500', concurrentResults.length === 10);

  // ============================================================
  console.log('\n--- ITEM 7: RETURN REQUEST DELIVERED_AT & MAX ATTEMPTS ---');
  // ============================================================
  // Test 1: If delivered_at is NULL respond 409 (do not fall back to updated_at)
  const prod7 = await call('create product for return rules test', 'POST', '/api/products', {
    name: 'Spark Plug Set ' + rnd(),
    oemPartNumber: 'FIX-RET-' + rnd(),
    brand: 'FixBrand',
    category: 'engine',
    pricePaise: 45000,
    stockQuantity: 10,
  }, S.tok, 201);
  const pId7 = find(prod7, 'id');

  const ordRet = await call('place order for return rules', 'POST', '/api/orders', {
    productId: pId7,
    quantity: 1,
    deliveryAddress: '700 Return Rules Way',
  }, bTok, 201);
  const ordRetId = find(ordRet, 'id');

  await call('seller accepts ordRet', 'PATCH', `/api/orders/${ordRetId}/status`, { status: 'accepted_by_seller' }, S.tok, 200);
  await call('rider claims ordRet', 'PATCH', `/api/delivery/${ordRetId}/claim`, null, dTok, 200);
  await call('rider marks out_for_delivery', 'PATCH', `/api/delivery/${ordRetId}/status`, { status: 'out_for_delivery' }, dTok, 200);
  await call('rider marks delivered', 'PATCH', `/api/delivery/${ordRetId}/status`, { status: 'delivered' }, dTok, 200);

  // Manually null out delivered_at in database while keeping status 'delivered'
  await queryDb('UPDATE orders SET delivered_at = NULL WHERE id = $1', [ordRetId]);

  // Attempt return request with delivered_at = NULL -> must respond 409
  const nullDeliveredRet = await call('return request with null delivered_at fails (409)', 'POST', `/api/orders/${ordRetId}/return`, {
    reason: 'Trying return without delivered_at',
  }, bTok, 409);
  check('return request with null delivered_at returned 409', nullDeliveredRet && (nullDeliveredRet.error || nullDeliveredRet.message));

  // Restore delivered_at timestamp
  await queryDb('UPDATE orders SET delivered_at = NOW() WHERE id = $1', [ordRetId]);

  // Test 2: env RETURN_MAX_ATTEMPTS (default 2) - at most that many return requests per order (all statuses)
  // Attempt 1: Valid return request
  const ret1 = await call('first return request succeeds (attempt 1/2)', 'POST', `/api/orders/${ordRetId}/return`, {
    reason: 'First defective part',
  }, bTok, 201);
  const ret1Id = find(ret1, 'id');
  check('first return request created', !!ret1Id);

  // Seller rejects return request 1
  await call('seller rejects return request 1', 'PATCH', `/api/returns/${ret1Id}/review`, {
    decision: 'rejected',
    note: 'Rejected first return attempt',
  }, S.tok, 200);

  // Attempt 2: Second return request succeeds
  const ret2 = await call('second return request succeeds (attempt 2/2)', 'POST', `/api/orders/${ordRetId}/return`, {
    reason: 'Second attempt with photos',
  }, bTok, 201);
  const ret2Id = find(ret2, 'id');
  check('second return request created', !!ret2Id);

  // Seller rejects return request 2
  await call('seller rejects return request 2', 'PATCH', `/api/returns/${ret2Id}/review`, {
    decision: 'rejected',
    note: 'Rejected second return attempt',
  }, S.tok, 200);

  // Attempt 3: Exceeds RETURN_MAX_ATTEMPTS (default 2) -> must respond 409
  const ret3 = await call('third return request rejected with 409 (max attempts reached)', 'POST', `/api/orders/${ordRetId}/return`, {
    reason: 'Third attempt should be rejected',
  }, bTok, 409);
  check('third return request rejected beyond max attempts (409)', ret3 && (ret3.error || ret3.message));

  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
  process.exit(fails ? 1 : 0);
})();

