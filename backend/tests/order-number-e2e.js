/**
 * Order Number E2E test suite.
 * Verifies SR-XXXXXXXX sequential format, DB persistence, exposure across endpoints,
 * and internal context integration.
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

(async () => {
  console.log('\n====== ORDER NUMBER (SR-XXXXXXXX) E2E ======\n');

  // --- Setup Admin, Seller, Buyer, Rider ---
  const aLogin = await call('admin login', 'POST', '/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD });
  const aTok = find(aLogin, 'accessToken');

  async function makeSeller(tag) {
    const phone = '9' + rnd() + '1';
    const reg = await call('register seller ' + tag, 'POST', '/api/auth/register', {
      fullName: 'OrderNum Seller ' + tag + ' ' + rnd(),
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
    fullName: 'OrderNum Buyer ' + rnd(),
    phone: '8' + rnd() + '2',
    password: PW,
    role: 'buyer',
  });
  const bTok = find(bReg, 'accessToken');
  const bId = find(bReg, 'id');

  const dReg = await call('register rider', 'POST', '/api/auth/register', {
    fullName: 'OrderNum Rider ' + rnd(),
    phone: '7' + rnd() + '4',
    password: PW,
    role: 'delivery_partner',
  });
  const dTok = find(dReg, 'accessToken');

  // Create product
  const oemPart = 'ONUM-' + rnd();
  const prod = await call('create product', 'POST', '/api/products', {
    name: 'Alternator (ONUM-E2E)',
    oemPartNumber: oemPart,
    brand: 'Bosch',
    category: 'electrical',
    pricePaise: 400000,
    stockQuantity: 20,
  }, S.tok, 201);
  const productId = find(prod, 'id');

  // ============================================================
  console.log('\n--- 1. Place Order 1 and verify order_number format ---');
  // ============================================================
  const ord1 = await call('place order 1', 'POST', '/api/orders', {
    productId,
    quantity: 1,
    deliveryAddress: '101 Sequence Blvd, Mumbai',
  }, bTok, 201);
  const orderId1 = find(ord1, 'id');
  const orderNumber1 = find(ord1, 'order_number');

  check('order_number exists on create response', !!orderNumber1, ord1);
  check('order_number format matches SR-XXXXXXXX', /^SR-\d{8}$/.test(orderNumber1 || ''), { orderNumber1 });

  // ============================================================
  console.log('\n--- 2. Place Order 2 and verify sequential increment ---');
  // ============================================================
  const ord2 = await call('place order 2', 'POST', '/api/orders', {
    productId,
    quantity: 1,
    deliveryAddress: '102 Sequence Blvd, Mumbai',
  }, bTok, 201);
  const orderId2 = find(ord2, 'id');
  const orderNumber2 = find(ord2, 'order_number');

  check('order 2 has order_number', !!orderNumber2, ord2);
  check('order 2 format matches SR-XXXXXXXX', /^SR-\d{8}$/.test(orderNumber2 || ''), { orderNumber2 });

  const num1 = parseInt(orderNumber1.replace('SR-', ''), 10);
  const num2 = parseInt(orderNumber2.replace('SR-', ''), 10);
  check('order numbers are sequentially incrementing (num2 == num1 + 1)', num2 === num1 + 1, { num1, num2, orderNumber1, orderNumber2 });

  // ============================================================
  console.log('\n--- 3. Expose order_number in GET /api/orders/my ---');
  // ============================================================
  const myOrdersRes = await call('buyer my orders', 'GET', '/api/orders/my', null, bTok);
  const myOrd1 = (myOrdersRes.data || []).find((o) => o.id === orderId1);
  const myOrd2 = (myOrdersRes.data || []).find((o) => o.id === orderId2);
  check('myOrders has order 1 order_number', myOrd1 && myOrd1.order_number === orderNumber1, myOrd1);
  check('myOrders has order 2 order_number', myOrd2 && myOrd2.order_number === orderNumber2, myOrd2);

  // ============================================================
  console.log('\n--- 4. Expose order_number in Seller Status update & Delivery available ---');
  // ============================================================
  const sellerAccept = await call('seller accepts order 1', 'PATCH', `/api/orders/${orderId1}/status`, { status: 'accepted_by_seller' }, S.tok, 200);
  check('order_number retained after seller accept', find(sellerAccept, 'order_number') === orderNumber1, sellerAccept);

  const availableDeliveries = await call('rider list available deliveries', 'GET', '/api/delivery/available', null, dTok, 200);
  const availOrd1 = (availableDeliveries.data || []).find((o) => o.id === orderId1);
  check('delivery available list includes order_number', availOrd1 && availOrd1.order_number === orderNumber1, availOrd1);

  // ============================================================
  console.log('\n--- 5. Expose order_number in Buyer Cancel ---');
  // ============================================================
  const cancelRes = await call('buyer cancels order 2', 'POST', `/api/orders/${orderId2}/cancel`, { reason: 'Test cancellation' }, bTok, 200);
  check('order_number retained after cancellation', find(cancelRes, 'order_number') === orderNumber2, cancelRes);

  // ============================================================
  console.log('\n--- 6. Internal API returns orderNumber in orders[] ---');
  // ============================================================
  const ctxRes = await call('internal customer context', 'GET', `/api/internal/customers/${bId}/context`, null, null, 200, { 'x-internal-api-key': INTERNAL_API_KEY });
  const internalOrders = ctxRes.data?.orders || [];
  const intOrd1 = internalOrders.find((o) => o.id === orderId1);
  const intOrd2 = internalOrders.find((o) => o.id === orderId2);

  check('internal context order 1 has orderNumber', intOrd1 && intOrd1.orderNumber === orderNumber1, intOrd1);
  check('internal context order 2 has orderNumber', intOrd2 && intOrd2.orderNumber === orderNumber2, intOrd2);

  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
  process.exit(fails ? 1 : 0);
})();
