const SR = 'http://localhost:4000';
const IQ = 'http://localhost:' + (process.env.IQ_PORT || '5001');
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const find = (o, k) => {
  if (o && typeof o === 'object') {
    if (k in o && o[k] != null) return o[k];
    for (const v of Object.values(o)) { const r = find(v, k); if (r != null) return r; }
  }
};
let fails = 0;
async function call(label, base, method, path, body, token, expect = [200, 201]) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  const ok = [].concat(expect).includes(res.status);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${res.status}] ${label}`);
  if (!ok) console.log('    ', JSON.stringify(json).replace(/("(?:accessToken|refreshToken)":")[^"]+/g, '$1***').slice(0, 500));
  return json;
}
function check(label, cond, extra) {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}       ${label}${cond ? '' : '  -> ' + JSON.stringify(extra).slice(0, 300)}`);
}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE || '9000000001';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin@12345678';

(async () => {
  const aLogin = await call('admin login (SpareRoute)', SR, 'POST', '/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD });
  const aTok = find(aLogin, 'accessToken');
  const bReg = await call('register buyer (SpareRoute)', SR, 'POST', '/api/auth/register', { fullName: 'IQ Buyer', phone: '8' + rnd() + '2', password: 'Test@12345678', role: 'buyer' });
  const bTok = find(bReg, 'accessToken');
  const buyerId = find(bReg, 'id');

  console.log('\n--- access control ---');
  await call('overview: no token -> 401', IQ, 'POST', '/api/admin/overview', {}, null, 401);
  await call('overview: buyer -> 403', IQ, 'POST', '/api/admin/overview', {}, bTok, 403);
  await call('profile: buyer -> 403', IQ, 'POST', '/api/admin/profile', { email: 'x@test.com', name: 'X' }, bTok, 403);
  await call('profile photo: buyer -> 403', IQ, 'POST', '/api/admin/profile/photo', { photo: null }, bTok, 403);
  await call('customers list: buyer -> 403', IQ, 'GET', '/api/customers', null, bTok, 403);
  await call('customer context: buyer -> 403', IQ, 'GET', `/api/customers/${buyerId}/context`, null, bTok, 403);

  console.log('\n--- overview (admin) ---');
  const ov = await call('overview: admin -> 200', IQ, 'POST', '/api/admin/overview', {}, aTok, 200);
  const d = ov.data || {};
  console.log('     overview keys:', Object.keys(d).join(', '));
  check('overview has NO customers/orders/payments keys', !('customers' in d) && !('orders' in d) && !('payments' in d), Object.keys(d));
  check('policies seeded (11)', Array.isArray(d.policies) && d.policies.length === 11, d.policies && d.policies.length);
  check('tickets/refunds/securityEvents are arrays', ['tickets', 'refunds', 'securityEvents'].every((k) => Array.isArray(d[k])), Object.keys(d));

  console.log('\n--- customers: moved to SpareRoute ---');
  await call('customers list: admin -> 501', IQ, 'GET', '/api/customers', null, aTok, 501);
  await call('customers create: admin -> 501', IQ, 'POST', '/api/customers', { name: 'Test User', email: 'tu@test.com' }, aTok, 501);
  const ctx = await call('context: real buyer -> 200', IQ, 'GET', `/api/customers/${buyerId}/context`, null, aTok, 200);
  check('context has customer + orders array', !!(ctx.data && ctx.data.customer && Array.isArray(ctx.data.orders)), ctx);
  await call('context: well-formed but unknown UUID -> 404', IQ, 'GET', '/api/customers/' + require('crypto').randomUUID() + '/context', null, aTok, 404);
  await call('context: non-UUID id -> 400', IQ, 'GET', '/api/customers/does-not-exist-123/context', null, aTok, 400);
  await call('context: bad chars -> 400', IQ, 'GET', '/api/customers/bad%20id%3B--/context', null, aTok, 400);

  console.log('\n--- admin profile (identity from JWT) ---');
  const p1 = await call('profile: get-or-create', IQ, 'POST', '/api/admin/profile', { email: `iq${rnd()}@test.com`, name: 'IQ Admin' }, aTok, 200);
  const code = find(p1, 'employee_code');
  const origName = find(p1, 'name');
  check('employee_code format INQ-ADM-###', /^INQ-ADM-\d{3,}$/.test(code || ''), code);
  const p2 = await call('profile: re-call without email is idempotent', IQ, 'POST', '/api/admin/profile', { name: origName }, aTok, 200);
  check('same employee_code on re-call', find(p2, 'employee_code') === code, p2);
  await call('rename', IQ, 'POST', '/api/admin/profile/name', { name: 'E2E Renamed' }, aTok, 200);
  await call('rename empty -> 400', IQ, 'POST', '/api/admin/profile/name', { name: '   ' }, aTok, 400);
  await call('rename ignores body email (still 200, own profile)', IQ, 'POST', '/api/admin/profile/name', { email: 'someone-else@test.com', name: origName }, aTok, 200);
  await call('photo: valid png -> 200', IQ, 'POST', '/api/admin/profile/photo', { photo: PNG }, aTok, 200);
  await call('photo: wrong type (gif) -> 400', IQ, 'POST', '/api/admin/profile/photo', { photo: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }, aTok, 400);
  await call('photo: not a data URL -> 400', IQ, 'POST', '/api/admin/profile/photo', { photo: 'http://evil.example/x.png' }, aTok, 400);
  await call('photo: too large (600KB) -> 400', IQ, 'POST', '/api/admin/profile/photo', { photo: 'data:image/png;base64,' + Buffer.alloc(600 * 1024).toString('base64') }, aTok, 400);
  await call('photo: null clears -> 200', IQ, 'POST', '/api/admin/profile/photo', { photo: null }, aTok, 200);

  console.log('\nNOTE: ownership between two admins, email collision (409) and parallel creates need 2+ admin users;');
  console.log('      those are covered by tests/admin_profile_test.js, not by this script.');
  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
  process.exit(fails ? 1 : 0);
})();
