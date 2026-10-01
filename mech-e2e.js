const SR = 'http://localhost:4000';
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const PW = 'Test@12345678';
const find = (o, k) => {
  if (o && typeof o === 'object') {
    if (k in o && o[k] != null) return o[k];
    for (const v of Object.values(o)) { const r = find(v, k); if (r != null) return r; }
  }
};
let fails = 0;
async function call(label, method, path, body, token, expect = [200, 201]) {
  const res = await fetch(SR + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  const ok = [].concat(expect).includes(res.status);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${res.status}] ${label}`);
  if (!ok || process.env.VERBOSE) console.log('    ', JSON.stringify(json).replace(/("(?:accessToken|refreshToken)":")[^"]+/g, '$1***').slice(0, 800));
  return json;
}
function check(label, cond, extra) {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}       ${label}${cond ? '' : '  -> ' + JSON.stringify(extra)}`);
}
(async () => {
  const aLogin = await call('admin login', 'POST', '/api/auth/login', { phone: '9000000001', password: 'Admin@12345678' });
  const aTok = find(aLogin, 'accessToken');

  async function makeSeller(tag) {
    const phone = '9' + rnd() + '1';
    const reg = await call('register seller ' + tag, 'POST', '/api/auth/register', { fullName: 'Mech Seller ' + tag + ' ' + rnd(), phone, password: PW, role: 'seller' });
    const tok = find(reg, 'accessToken');
    const ini = await call('kyc initiate ' + tag, 'POST', '/api/kyc/initiate', { aadhaarNumber: '123412341234' }, tok);
    await call('kyc confirm ' + tag, 'POST', '/api/kyc/confirm', { referenceId: find(ini, 'referenceId'), otp: '123456' }, tok);
    const pend = await call('pending sellers ' + tag, 'GET', '/api/admin/sellers/pending', null, aTok);
    const me = (pend.data || []).find((x) => x.phone === phone);
    if (!me) { console.log('>>> seller pending list mein nahi mila'); process.exit(1); }
    await call('approve seller ' + tag, 'PATCH', `/api/admin/sellers/${me.id}/approve`, { approve: true }, aTok);
    return { tok, sellerId: me.id };
  }
  const A = await makeSeller('A');
  const B = await makeSeller('B');
  const bReg = await call('register buyer', 'POST', '/api/auth/register', { fullName: 'Mech Buyer', phone: '8' + rnd() + '2', password: PW, role: 'buyer' });
  const bTok = find(bReg, 'accessToken');
  const dReg = await call('register rider', 'POST', '/api/auth/register', { fullName: 'Mech Rider', phone: '7' + rnd() + '3', password: PW, role: 'delivery_partner' });
  const dTok = find(dReg, 'accessToken');

  console.log('\n--- mechanics CRUD ---');
  await call('mechanic: bad phone rejected', 'POST', '/api/mechanics', { name: 'Bad Phone', phone: '12345', serviceFeePaise: 1000 }, A.tok, 400);
  await call('mechanic: buyer cannot create', 'POST', '/api/mechanics', { name: 'Nope', phone: '9876543210', serviceFeePaise: 1000 }, bTok, 403);
  const mA = await call('mechanic: seller A creates (fee 30000)', 'POST', '/api/mechanics', { name: 'Ramesh Mechanic', phone: '9876543210', serviceFeePaise: 30000 }, A.tok, 201);
  const mB = await call('mechanic: seller B creates', 'POST', '/api/mechanics', { name: 'Suresh Mechanic', phone: '9876543211', serviceFeePaise: 50000 }, B.tok, 201);
  const mechA = find(mA, 'id'), mechB = find(mB, 'id');
  const pub = await call('mechanic: public list for seller A', 'GET', `/api/mechanics/seller/${A.sellerId}`);
  check('public list has exactly 1 mechanic (A\'s)', (pub.data || []).length === 1, pub);
  await call('mechanic: seller B cannot edit A\'s mechanic', 'PATCH', `/api/mechanics/${mechA}`, { name: 'Hacked' }, B.tok, 404);

  console.log('\n--- order with mechanic ---');
  const prod = await call('product: seller A creates', 'POST', '/api/products', { name: 'Clutch Plate (MECH-E2E)', oemPartNumber: 'ME-CP-1', brand: 'T', category: 'clutch', pricePaise: 250000, stockQuantity: 5 }, A.tok, 201);
  const productId = find(prod, 'id');
  await call('order: seller B\'s mechanic on A\'s product rejected', 'POST', '/api/orders', { productId, quantity: 1, deliveryAddress: '12 Test Street, Noida', mechanicId: mechB }, bTok, 400);
  const ord = await call('order: with seller A\'s mechanic', 'POST', '/api/orders', { productId, quantity: 1, deliveryAddress: '12 Test Street, Noida', mechanicId: mechA }, bTok, 201);
  const orderId = find(ord, 'id');
  check('service_fee_paise == 30000', Number(find(ord, 'service_fee_paise')) === 30000, ord);
  check('mechanic_id stored on order', find(ord, 'mechanic_id') === mechA, ord);

  console.log('\n--- rating rules ---');
  await call('rate before delivered rejected', 'PATCH', `/api/orders/${orderId}/rate-mechanic`, { rating: 5 }, bTok, 400);
  await call('seller accepts', 'PATCH', `/api/orders/${orderId}/status`, { status: 'accepted_by_seller' }, A.tok);
  await call('rider claims', 'PATCH', `/api/delivery/${orderId}/claim`, null, dTok);
  await call('out for delivery', 'PATCH', `/api/delivery/${orderId}/status`, { status: 'out_for_delivery' }, dTok);
  await call('delivered', 'PATCH', `/api/delivery/${orderId}/status`, { status: 'delivered' }, dTok);
  await call('rating 6 rejected (validation)', 'PATCH', `/api/orders/${orderId}/rate-mechanic`, { rating: 6 }, bTok, 400);
  await call('rate 5 after delivery', 'PATCH', `/api/orders/${orderId}/rate-mechanic`, { rating: 5, comment: 'Kaam badhiya' }, bTok, 200);
  await call('double rating rejected', 'PATCH', `/api/orders/${orderId}/rate-mechanic`, { rating: 1 }, bTok, 409);
  const after = await call('public list after rating', 'GET', `/api/mechanics/seller/${A.sellerId}`);
  const m = (after.data || [])[0] || {};
  check('avg_rating == 5', Number(m.avg_rating) === 5, m);
  check('total_ratings == 1', Number(m.total_ratings) === 1, m);

  console.log('\n--- deactivate ---');
  await call('seller A deactivates mechanic', 'PATCH', `/api/mechanics/${mechA}`, { isActive: false }, A.tok, 200);
  await call('order with inactive mechanic rejected', 'POST', '/api/orders', { productId, quantity: 1, deliveryAddress: '12 Test Street, Noida', mechanicId: mechA }, bTok, 404);
  const empty = await call('public list hides inactive', 'GET', `/api/mechanics/seller/${A.sellerId}`);
  check('public list empty', (empty.data || []).length === 0, empty);

  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
  process.exit(fails ? 1 : 0);
})();
