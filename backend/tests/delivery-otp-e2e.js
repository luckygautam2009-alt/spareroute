const SR = 'http://localhost:4000';
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const find = (o, k) => {
  if (o && typeof o === 'object') {
    if (k in o && o[k] != null) return o[k];
    for (const v of Object.values(o)) { const r = find(v, k); if (r != null) return r; }
  }
};
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE || '9000000001';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin@12345678';
const PW = 'Test@12345678';
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
  if (!ok) console.log('    ', JSON.stringify(json).replace(/("(?:accessToken|refreshToken|otp)":")[^"]+/g, '$1***').slice(0, 300));
  return { status: res.status, json };
}
function check(label, cond, extra) {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}       ${label}${cond ? '' : '  -> ' + String(extra).slice(0, 200)}`);
}
const c = (arr, code) => arr.filter((x) => x === code).length;
const par = (n, fn) => Promise.all(Array.from({ length: n }, fn));
const wrongOf = (otp) => String((Number(otp) + 1) % 1000000).padStart(6, '0');

(async () => {
  const aTok = find((await call('admin login', 'POST', '/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD })).json, 'accessToken');
  const phoneS = '9' + rnd() + '1';
  const sTok = find((await call('register seller', 'POST', '/api/auth/register', { fullName: 'OTP Seller ' + rnd(), phone: phoneS, password: PW, role: 'seller' }, null, 201)).json, 'accessToken');
  const ini = await call('kyc initiate', 'POST', '/api/kyc/initiate', { aadhaarNumber: '123412341234' }, sTok);
  await call('kyc confirm', 'POST', '/api/kyc/confirm', { referenceId: find(ini.json, 'referenceId'), otp: '123456' }, sTok);
  const pend = await call('pending sellers', 'GET', '/api/admin/sellers/pending', null, aTok);
  const me = (pend.json.data || []).find((x) => x.phone === phoneS);
  if (!me) { console.log('seller not in pending list'); process.exit(1); }
  await call('approve seller', 'PATCH', `/api/admin/sellers/${me.id}/approve`, { approve: true }, aTok);
  const productId = find((await call('create product', 'POST', '/api/products', { name: 'OTP Test Part', oemPartNumber: 'OTP-1', brand: 'T', category: 'clutch', pricePaise: 250000, stockQuantity: 100 }, sTok, 201)).json, 'id');
  const reg = async (role, p, n) => find((await call(`register ${n}`, 'POST', '/api/auth/register', { fullName: 'OTP ' + n, phone: p + rnd() + '2', password: PW, role }, null, 201)).json, 'accessToken');
  const bTok = await reg('buyer', '8', 'buyer');
  const b2Tok = await reg('buyer', '8', 'buyer2');
  const dTok = await reg('delivery_partner', '7', 'rider');
  const d2Tok = await reg('delivery_partner', '7', 'rider2');

  async function outForDelivery(tag) {
    const o = await call(`${tag}: place order`, 'POST', '/api/orders', { productId, quantity: 1, deliveryAddress: '12 Test Street, Noida' }, bTok, 201);
    const id = find(o.json, 'id');
    await call(`${tag}: seller accepts`, 'PATCH', `/api/orders/${id}/status`, { status: 'accepted_by_seller' }, sTok);
    await call(`${tag}: rider claims`, 'PATCH', `/api/delivery/${id}/claim`, null, dTok);
    await call(`${tag}: out for delivery`, 'PATCH', `/api/delivery/${id}/status`, { status: 'out_for_delivery' }, dTok);
    return id;
  }
  const otpOf = async (id) => String((await call('buyer reveals code', 'GET', `/api/orders/${id}/delivery-otp`, null, bTok, 200)).json.data.otp);
  const myStatus = async (id) => ((await call('my orders', 'GET', '/api/orders/my', null, bTok, 200)).json.data || []).find((o) => o.id === id)?.status;
  const deliver = (id, otp, tok = dTok, expect = 200, label = 'deliver') => call(label, 'PATCH', `/api/delivery/${id}/status`, otp === undefined ? { status: 'delivered' } : { status: 'delivered', otp }, tok, expect);
  const deliverRaw = (id, otp) => fetch(`${SR}/api/delivery/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dTok}` }, body: JSON.stringify({ status: 'delivered', otp }) }).then((r) => r.status);

  console.log('\n--- A: basic flow ---');
  const o1 = await outForDelivery('A');
  await deliver(o1, undefined, dTok, 400, 'delivered without otp -> 400');
  const otp1 = await otpOf(o1);
  check('code is 6 digits', /^\d{6}$/.test(otp1), 'bad format');
  await call('other buyer cannot reveal -> 404', 'GET', `/api/orders/${o1}/delivery-otp`, null, b2Tok, 404);
  await deliver(o1, '12345', dTok, 400, 'malformed code (5 digits) -> 400');
  await deliver(o1, wrongOf(otp1), dTok, 400, 'wrong code -> 400');
  check('still out_for_delivery after wrong code', (await myStatus(o1)) === 'out_for_delivery', 'status changed');
  await deliver(o1, otp1, d2Tok, 404, 'another rider cannot confirm -> 404');
  await deliver(o1, otp1, dTok, 200, 'correct code -> 200');
  check('order is delivered', (await myStatus(o1)) === 'delivered', 'not delivered');
  await deliver(o1, otp1, dTok, 409, 'replay on delivered order -> 409');
  await call('reveal after delivery -> 409', 'GET', `/api/orders/${o1}/delivery-otp`, null, bTok, 409);

  console.log('\n--- B: regenerate ---');
  const o2 = await outForDelivery('B');
  const old = await otpOf(o2);
  let latest = old;
  for (let i = 1; i <= 3; i++) latest = String((await call(`regenerate #${i} -> 200`, 'POST', `/api/orders/${o2}/delivery-otp/regenerate`, null, bTok, 200)).json.data.otp);
  await call('4th regenerate -> 409', 'POST', `/api/orders/${o2}/delivery-otp/regenerate`, null, bTok, 409);
  if (latest !== old) await deliver(o2, old, dTok, 400, 'old code rejected after regenerate -> 400');
  await deliver(o2, latest, dTok, 200, 'latest code accepted -> 200');

  console.log('\n--- C: lock after 5 wrong attempts (sequential) ---');
  const o3 = await outForDelivery('C');
  const otp3 = await otpOf(o3);
  for (let i = 1; i <= 5; i++) await deliver(o3, wrongOf(otp3), dTok, 400, `wrong attempt ${i} -> 400`);
  await deliver(o3, wrongOf(otp3), dTok, 423, '6th attempt -> 423');
  await deliver(o3, otp3, dTok, 423, 'CORRECT code after lock -> 423');
  await call('buyer cannot regenerate when locked -> 409', 'POST', `/api/orders/${o3}/delivery-otp/regenerate`, null, bTok, 409);

  console.log('\n--- D: 20 PARALLEL wrong guesses ---');
  const o4 = await outForDelivery('D');
  const otp4 = await otpOf(o4);
  const r4 = await par(20, () => deliverRaw(o4, wrongOf(otp4)));
  check('exactly 5 attempts counted (400), the other 15 locked (423)', c(r4, 400) === 5 && c(r4, 423) === 15, r4.join(','));
  check('no 500s', !r4.includes(500), r4.join(','));
  await deliver(o4, otp4, dTok, 423, 'correct code after parallel lock -> 423');

  console.log('\n--- E: 4 PARALLEL correct confirmations ---');
  const o5 = await outForDelivery('E');
  const otp5 = await otpOf(o5);
  const r5 = await par(4, () => deliverRaw(o5, otp5));
  check('exactly one 200, the rest 409', c(r5, 200) === 1 && c(r5, 409) === 3, r5.join(','));

  console.log('\n--- F: admin override ---');
  const o6 = await outForDelivery('F');
  const reason = 'Customer unreachable, cash confirmed by phone';
  const fd = (body, tok, expect, label) => call(label, 'POST', `/api/admin/orders/${o6}/force-deliver`, body, tok, expect);
  await fd({ reason, cashCollected: true }, bTok, 403, 'non-admin force-deliver -> 403');
  await fd({ cashCollected: true }, aTok, 400, 'missing reason -> 400');
  await fd({ reason: 'short', cashCollected: true }, aTok, 400, 'short reason -> 400');
  await fd({ reason, cashCollected: false }, aTok, 400, 'cashCollected false -> 400');
  await fd({ reason, cashCollected: true }, aTok, 200, 'admin force-deliver -> 200');
  check('order is delivered', (await myStatus(o6)) === 'delivered', 'not delivered');
  await fd({ reason, cashCollected: true }, aTok, 409, 'force-deliver replay -> 409');

  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
  process.exit(fails ? 1 : 0);
})();
