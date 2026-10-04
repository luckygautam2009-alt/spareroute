/**
 * Validation E2E test suite.
 * Verifies that malformed IDs, invalid query parameters, and bad payloads return HTTP 400 (not 500)
 * with the unified error envelope { success: false, error, message }.
 */
const SR = 'http://localhost:4000';
const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const PW = 'Test@12345678';
const ADMIN_PHONE = process.env.E2E_ADMIN_PHONE || '9000000001';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin@12345678';

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
  console.log('\n====== INPUT VALIDATION (400 NOT 500) E2E ======\n');

  // Admin login
  const aLogin = await call('admin login', 'POST', '/api/auth/login', { phone: ADMIN_PHONE, password: ADMIN_PASSWORD });
  const aTok = find(aLogin, 'accessToken');

  // Register seller & approve
  const sPhone = '9' + rnd() + '1';
  const sReg = await call('register seller', 'POST', '/api/auth/register', {
    fullName: 'Val Seller ' + rnd(),
    phone: sPhone,
    password: PW,
    role: 'seller',
  });
  const sTok = find(sReg, 'accessToken');
  const ini = await call('kyc initiate', 'POST', '/api/kyc/initiate', { aadhaarNumber: '123412341234' }, sTok);
  await call('kyc confirm', 'POST', '/api/kyc/confirm', { referenceId: find(ini, 'referenceId'), otp: '123456' }, sTok);
  const pend = await call('pending sellers', 'GET', '/api/admin/sellers/pending', null, aTok);
  const me = (pend.data || []).find((x) => x.phone === sPhone);
  await call('approve seller', 'PATCH', `/api/admin/sellers/${me.id}/approve`, { approve: true }, aTok);

  // Register buyer
  const bReg = await call('register buyer', 'POST', '/api/auth/register', {
    fullName: 'Val Buyer ' + rnd(),
    phone: '8' + rnd() + '2',
    password: PW,
    role: 'buyer',
  });
  const bTok = find(bReg, 'accessToken');

  const badId = 'not-a-valid-uuid-123';

  // ============================================================
  console.log('\n--- 1. POST /api/orders/:orderId/cancel with malformed id ---');
  // ============================================================
  const cancelRes = await call('cancel with malformed orderId -> 400', 'POST', `/api/orders/${badId}/cancel`, { reason: 'Test' }, bTok, 400);
  check('cancel error envelope has success: false', cancelRes.success === false, cancelRes);
  check('cancel error contains Invalid input', cancelRes.error && cancelRes.error.includes('Invalid input'), cancelRes);

  // ============================================================
  console.log('\n--- 2. POST /api/orders/:orderId/return with malformed id ---');
  // ============================================================
  const returnRes = await call('return with malformed orderId -> 400', 'POST', `/api/orders/${badId}/return`, { reason: 'Defective part' }, bTok, 400);
  check('return error envelope has success: false', returnRes.success === false, returnRes);
  check('return error contains Invalid input', returnRes.error && returnRes.error.includes('Invalid input'), returnRes);

  // ============================================================
  console.log('\n--- 3. PATCH /api/returns/:id/review with malformed id ---');
  // ============================================================
  const reviewRes = await call('review with malformed id -> 400', 'PATCH', `/api/returns/${badId}/review`, { decision: 'approved' }, sTok, 400);
  check('review error envelope has success: false', reviewRes.success === false, reviewRes);
  check('review error contains Invalid input', reviewRes.error && reviewRes.error.includes('Invalid input'), reviewRes);

  // ============================================================
  console.log('\n--- 4. PATCH /api/returns/:id/received with malformed id ---');
  // ============================================================
  const receivedRes = await call('received with malformed id -> 400', 'PATCH', `/api/returns/${badId}/received`, null, sTok, 400);
  check('received error envelope has success: false', receivedRes.success === false, receivedRes);
  check('received error contains Invalid input', receivedRes.error && receivedRes.error.includes('Invalid input'), receivedRes);

  // ============================================================
  console.log('\n--- 5. PATCH /api/admin/refunds/:id/process with malformed id ---');
  // ============================================================
  const processRes = await call('process refund with malformed id -> 400', 'PATCH', `/api/admin/refunds/${badId}/process`, { status: 'processed' }, aTok, 400);
  check('process error envelope has success: false', processRes.success === false, processRes);
  check('process error contains Invalid input', processRes.error && processRes.error.includes('Invalid input'), processRes);

  // ============================================================
  console.log('\n--- 6. GET /api/admin/refunds query validation ---');
  // ============================================================
  const invalidStatusRes = await call('refunds with invalid status -> 400', 'GET', '/api/admin/refunds?status=cancelled', null, aTok, 400);
  check('invalid status returned 400', invalidStatusRes.success === false, invalidStatusRes);

  const invalidOrderIdRes = await call('refunds with invalid orderId -> 400', 'GET', `/api/admin/refunds?orderId=${badId}`, null, aTok, 400);
  check('invalid orderId returned 400', invalidOrderIdRes.success === false, invalidOrderIdRes);

  const invalidPageRes = await call('refunds with invalid page -> 400', 'GET', '/api/admin/refunds?page=abc', null, aTok, 400);
  check('invalid page returned 400', invalidPageRes.success === false, invalidPageRes);

  const invalidLimitRes = await call('refunds with invalid limit -> 400', 'GET', '/api/admin/refunds?limit=xyz', null, aTok, 400);
  check('invalid limit returned 400', invalidLimitRes.success === false, invalidLimitRes);

  const validQueryRes = await call('refunds with valid query params -> 200', 'GET', '/api/admin/refunds?status=pending&page=1&limit=10', null, aTok, 200);
  check('valid query returned 200', validQueryRes.success === true && Array.isArray(validQueryRes.data), validQueryRes);

  console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`);
  process.exit(fails ? 1 : 0);
})();
