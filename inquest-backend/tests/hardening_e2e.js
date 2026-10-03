#!/usr/bin/env node
/**
 * Hardening E2E Test Suite
 * Validates CORS, body limits, malformed JSON handling, unified error envelopes,
 * per-user rate limiters, readiness/health probes, and trust-proxy behavior
 * across both Inquest and SpareRoute backend services.
 */

const SR = process.env.SPAREROUTE_URL || 'http://localhost:4000';
const IQ = process.env.INQUEST_URL || 'http://localhost:5001';

const rnd = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const PW = 'Test@12345678';

let fails = 0;

function check(label, cond, extra) {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}       ${label}${cond ? '' : '  -> ' + JSON.stringify(extra)}`);
}

async function request(label, url, options = {}, expect = [200]) {
  try {
    const res = await fetch(url, options);
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
      console.log('     response:', JSON.stringify(json).slice(0, 500));
    }
    return { status: res.status, headers: res.headers, json };
  } catch (err) {
    fails++;
    console.log(`FAIL [ERR] ${label} -> ${err.message}`);
    return { status: 0, headers: new Headers(), json: { error: err.message } };
  }
}

(async () => {
  console.log('================================================================');
  console.log('   PRODUCTION HARDENING E2E TEST SUITE');
  console.log('================================================================\n');

  // ── 1. Inquest Health & Readiness Probes ────────────────────────────────────
  console.log('--- 1. Inquest Health & Readiness Probes ---');
  const iqHealth = await request('Inquest GET /health returns 200', `${IQ}/health`, {}, 200);
  check('Inquest health status is ok', iqHealth.json.status === 'ok' && iqHealth.json.success === true, iqHealth.json);

  const iqApiHealth = await request('Inquest GET /api/health returns 200', `${IQ}/api/health`, {}, 200);
  check('Inquest api/health success is true', iqApiHealth.json.success === true, iqApiHealth.json);

  const iqReady = await request('Inquest GET /ready returns 200', `${IQ}/ready`, {}, 200);
  check('Inquest ready status is ready', iqReady.json.status === 'ready' && iqReady.json.success === true, iqReady.json);

  // ── 2. Inquest CORS Hardening ───────────────────────────────────────────────
  console.log('\n--- 2. Inquest CORS Hardening ---');
  const evilCors = await request(
    'Inquest rejects evil origin',
    `${IQ}/health`,
    {
      method: 'GET',
      headers: { Origin: 'https://evil.attacker.example.com' },
    },
    200
  );
  const evilAcao = evilCors.headers.get('access-control-allow-origin');
  check('Evil origin does NOT receive Access-Control-Allow-Origin', !evilAcao || evilAcao !== 'https://evil.attacker.example.com', { evilAcao });

  const allowedOrigin = 'http://localhost:5173';
  const goodCors = await request(
    'Inquest allows configured origin (localhost:5173)',
    `${IQ}/health`,
    {
      method: 'GET',
      headers: { Origin: allowedOrigin },
    },
    200
  );
  const goodAcao = goodCors.headers.get('access-control-allow-origin');
  check('Configured origin receives Access-Control-Allow-Origin', goodAcao === allowedOrigin, { goodAcao });

  // ── 3. Inquest Body Limits & Malformed JSON ──────────────────────────────────
  console.log('\n--- 3. Inquest Body Limits & Malformed JSON ---');
  // 2MB JSON body -> expect 413
  const largePayload = JSON.stringify({ padding: 'X'.repeat(2 * 1024 * 1024) });
  const iqLarge = await request(
    'Inquest 2MB payload -> 413 with configured limit message',
    `${IQ}/api/complaints`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largePayload,
    },
    413
  );
  check('Inquest 413 envelope unified (success: false, error == message)', iqLarge.json.success === false && iqLarge.json.error === iqLarge.json.message, iqLarge.json);
  check('Inquest 413 message contains max allowed size', typeof iqLarge.json.error === 'string' && iqLarge.json.error.includes('1mb'), iqLarge.json);

  // Malformed JSON -> expect 400
  const iqMalformed = await request(
    'Inquest malformed JSON -> 400',
    `${IQ}/api/complaints`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"brokenJson": true, missing_closing_bracket',
    },
    400
  );
  check('Inquest malformed JSON envelope unified', iqMalformed.json.success === false && iqMalformed.json.error === 'Malformed JSON in request body.' && iqMalformed.json.message === 'Malformed JSON in request body.', iqMalformed.json);

  // ── 4. Inquest Unknown Route & Unified Envelope ─────────────────────────────
  console.log('\n--- 4. Inquest Unknown Route (Unified Envelope) ---');
  const iq404 = await request(
    'Inquest unknown route -> 404 in unified envelope',
    `${IQ}/api/nonexistent_route_${rnd()}`,
    { method: 'GET' },
    404
  );
  check('Inquest 404 has success: false', iq404.json.success === false, iq404.json);
  check('Inquest 404 has error and message keys identical', iq404.json.error && iq404.json.error === iq404.json.message, iq404.json);

  // ── 5. Inquest Per-User Rate Limiting ────────────────────────────────────────
  console.log('\n--- 5. Inquest Per-User Rate Limiting ---');
  // Register a new buyer on SpareRoute to get a valid JWT
  const buyerPhone = '8' + rnd() + '2';
  const buyerReg = await request(
    'Register buyer on SpareRoute for rate-limit test',
    `${SR}/api/auth/register`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'RateLimit Buyer', phone: buyerPhone, password: PW, role: 'buyer' }),
    },
    [200, 201]
  );
  const buyerToken = buyerReg.json.data?.accessToken || buyerReg.json.accessToken;
  check('Buyer token received', !!buyerToken, buyerReg.json);

  if (buyerToken) {
    // Submit invalid complaints (fails validation before Gemini is ever invoked)
    // Default limit is 10/hour, so requests 1..10 will return 400, and request 11 will return 429.
    console.log('     Sending 10 invalid complaint requests (expecting 400 validation failures)...');
    let allValidationFailed = true;
    for (let i = 1; i <= 10; i++) {
      const res = await fetch(`${IQ}/api/complaints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerToken}`,
        },
        body: JSON.stringify({}), // Empty body fails validation
      });
      if (res.status !== 400) {
        allValidationFailed = false;
        console.log(`     Request #${i} returned unexpected status ${res.status}`);
      }
    }
    check('All 10 invalid requests failed validation (HTTP 400)', allValidationFailed);

    // 11th request must hit the per-user rate limiter (HTTP 429)
    const rateLimitedRes = await request(
      '11th complaint request from same user -> 429 Too Many Requests',
      `${IQ}/api/complaints`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerToken}`,
        },
        body: JSON.stringify({}),
      },
      429
    );
    check('Rate limit response has success: false', rateLimitedRes.json.success === false, rateLimitedRes.json);
    check('Rate limit error mentions too many complaints', typeof rateLimitedRes.json.error === 'string' && rateLimitedRes.json.error.includes('Too many complaints'), rateLimitedRes.json);
    check('Rate limit envelope is unified', rateLimitedRes.json.error === rateLimitedRes.json.message, rateLimitedRes.json);
  }

  // ── 6. SpareRoute Health & Readiness Probes ─────────────────────────────────
  console.log('\n--- 6. SpareRoute Health & Readiness Probes ---');
  const srHealth = await request('SpareRoute GET /health returns 200', `${SR}/health`, {}, 200);
  check('SpareRoute health status is ok', srHealth.json.status === 'ok' && srHealth.json.success === true, srHealth.json);

  const srReady = await request('SpareRoute GET /ready returns 200', `${SR}/ready`, {}, 200);
  check('SpareRoute ready status is ready', srReady.json.status === 'ready' && srReady.json.success === true, srReady.json);

  // ── 7. SpareRoute Unified Error Envelope & Limits ───────────────────────────
  console.log('\n--- 7. SpareRoute Unified Error Envelope & Body Limits ---');
  const sr404 = await request(
    'SpareRoute unknown route -> 404 in unified envelope',
    `${SR}/api/nonexistent_${rnd()}`,
    { method: 'GET' },
    404
  );
  check('SpareRoute 404 has success: false', sr404.json.success === false, sr404.json);
  check('SpareRoute 404 has error and message keys identical', sr404.json.error && sr404.json.error === sr404.json.message, sr404.json);

  const srMalformed = await request(
    'SpareRoute malformed JSON -> 400',
    `${SR}/api/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"brokenJson": true, missing_brace',
    },
    400
  );
  check('SpareRoute malformed JSON unified envelope', srMalformed.json.success === false && srMalformed.json.error === 'Malformed JSON in request body.' && srMalformed.json.message === 'Malformed JSON in request body.', srMalformed.json);

  // ── 8. Trust Proxy Checks ───────────────────────────────────────────────────
  console.log('\n--- 8. Trust Proxy Configuration Checks ---');
  // Send request with X-Forwarded-For header to verify reverse proxy transparency
  const proxyCheck = await request(
    'SpareRoute accepts X-Forwarded-For header under configured trust proxy',
    `${SR}/health`,
    {
      method: 'GET',
      headers: { 'X-Forwarded-For': '203.0.113.195, 70.41.3.18' },
    },
    200
  );
  check('SpareRoute responds normally behind proxy header', proxyCheck.json.status === 'ok', proxyCheck.json);

  const iqProxyCheck = await request(
    'Inquest accepts X-Forwarded-For header under configured trust proxy',
    `${IQ}/health`,
    {
      method: 'GET',
      headers: { 'X-Forwarded-For': '198.51.100.12' },
    },
    200
  );
  check('Inquest responds normally behind proxy header', iqProxyCheck.json.status === 'ok', iqProxyCheck.json);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  if (fails === 0) {
    console.log('   ALL HARDENING TESTS PASSED 🎉');
  } else {
    console.log(`   ${fails} TEST(S) FAILED ❌`);
  }
  console.log('================================================================\n');

  process.exit(fails ? 1 : 0);
})();
