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

  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
  process.exit(fails ? 1 : 0);
})();
