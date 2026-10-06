const SR = 'http://localhost:4000', IQ = 'http://localhost:5001';
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const PW = 'Test@12345678';
const find = (o, k) => {
  if (o && typeof o === 'object') {
    if (k in o && o[k] != null) return o[k];
    for (const v of Object.values(o)) { const r = find(v, k); if (r != null) return r; }
  }
};
async function call(label, base, method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  const shown = JSON.stringify(json).replace(/("(?:accessToken|refreshToken|token)":")[^"]+/gi, '$1***');
  console.log(`\n[${res.status}] ${label}\n${shown.slice(0, 6000)}`);
  if (!res.ok) { console.log('\n>>> STOPPED at:', label); process.exit(1); }
  return json;
}
(async () => {
  const sPhone = '9' + rnd() + '1', bPhone = '8' + rnd() + '2', dPhone = '7' + rnd() + '3';
  const sName = 'E2E Seller ' + rnd();
  const reg = (name, phone, role) => call('register ' + role, SR, 'POST', '/api/auth/register', { fullName: name, phone, password: PW, role });
  const sReg = await reg(sName, sPhone, 'seller');
  const bReg = await reg('E2E Buyer', bPhone, 'buyer');
  const dReg = await reg('E2E Rider', dPhone, 'delivery_partner');
  const tok = (r) => find(r, 'accessToken');
  const sTok = tok(sReg), bTok = tok(bReg), dTok = tok(dReg);
  const bId = find(bReg, 'id');

  const ini = await call('kyc initiate', SR, 'POST', '/api/kyc/initiate', { aadhaarNumber: '123412341234' }, sTok);
  await call('kyc confirm (stub OTP)', SR, 'POST', '/api/kyc/confirm', { referenceId: find(ini, 'referenceId'), otp: '123456' }, sTok);

const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE || '9000000001';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin@12345678';

  const aLogin = await call('admin login', SR, 'POST', '/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD });
  const aTok = tok(aLogin);
  const pend = await call('pending sellers', SR, 'GET', '/api/admin/sellers/pending', null, aTok);
  const list = Array.isArray(pend.data) ? pend.data : (find(pend, 'sellers') || []);
  const me = list.find((x) => JSON.stringify(x).includes(sName)) || list.find((x) => JSON.stringify(x).includes(sPhone));
  if (!me) { console.log('\n>>> Seller pending list mein nahi mila, upar ka output paste kar'); process.exit(1); }
  await call('approve seller', SR, 'PATCH', `/api/admin/sellers/${me.sellerId ?? me.id}/approve`, { approve: true }, aTok);

  const prod = await call('create product', SR, 'POST', '/api/products', {
    name: 'Brake Pad Set (E2E)', oemPartNumber: 'E2E-BP-001', brand: 'TestBrand', category: 'brakes', pricePaise: 250000, stockQuantity: 5,
  }, sTok);
  const productId = find(prod, 'id');
  const ord = await call('create order', SR, 'POST', '/api/orders', { productId, quantity: 1, deliveryAddress: '12 Test Street, Noida' }, bTok);
  const orderId = find(ord, 'id');
  await call('seller accepts', SR, 'PATCH', `/api/orders/${orderId}/status`, { status: 'accepted_by_seller' }, sTok);
  await call('rider sees available', SR, 'GET', '/api/delivery/available', null, dTok);
  await call('rider claims', SR, 'PATCH', `/api/delivery/${orderId}/claim`, null, dTok);
  await call('out for delivery', SR, 'PATCH', `/api/delivery/${orderId}/status`, { status: 'out_for_delivery' }, dTok);
  await call('delivered', SR, 'PATCH', `/api/delivery/${orderId}/status`, { status: 'delivered' }, dTok);

  const c = await call('INQUEST complaint', IQ, 'POST', '/api/complaints',
    { complaintText: 'Mera brake pad set order deliver ho gaya hai lekin part galat hai, mujhe refund chahiye' }, bTok);
  console.log('\nDONE. buyerId:', bId, ' orderId:', orderId);
})();
