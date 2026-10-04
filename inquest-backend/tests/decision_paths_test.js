/**
 * Decision-path unit tests — no server, no DB, no network.
 * Each test builds a minimal fake context and asserts the exact
 * decision field produced by decisionEngine / policyEngine.
 *
 * Run: node tests/decision_paths_test.js
 */

'use strict';

const { decide } = require('../src/services/decisionEngine');
const { evaluatePolicyConditions } = require('../src/services/policyEngine');

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual  : ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const CUSTOMER_ID = 'cust-abc-001';
const ORDER_ID = 'ord-uuid-001';

function makePolicy(id, extra = {}) {
  return { id, eligible_within_days: 10, ...extra };
}

function baseInvestigation(overrides = {}) {
  return {
    found: true,
    customer: { id: CUSTOMER_ID },
    orders: [],
    payments: [],
    refunds: [],
    focusOrder: null,
    focusPayments: [],
    focusRefunds: [],
    securityEvents: [],
    tickets: [],
    policies: [],
    orderVerified: false,
    orderInferred: false,
    orderMismatch: false,
    orderHintDetected: null,
    ...overrides,
  };
}

function baseAnalysis(intent = 'refund/return', sentiment = 'neutral', extra = {}) {
  return { intent, sentiment, subIntent: '', orderReference: null, entities: {}, ...extra };
}

function baseRootCause(matchedPolicy, confidence = 90) {
  return { matchedPolicy, confidence };
}

// ── Safety Guard 1: Order ownership / cross-customer attempt ─────────────────

console.log('\n[Safety Guard 1] Order ownership mismatch');
{
  const inv = baseInvestigation({ orderMismatch: true, orderHintDetected: 'SR-00000099', orderVerified: false });
  const result = decide('', baseAnalysis(), baseRootCause('POLICY3'), inv);
  assert('decision is HUMAN_ESCALATION', result.decision, 'HUMAN_ESCALATION');
  assert('confidence is 0', result.confidence, 0);
}

// ── Safety Guard 2: Security / unauthorized activity ─────────────────────────

console.log('\n[Safety Guard 2] Security intent (POLICY9)');
{
  const inv = baseInvestigation({ policies: [makePolicy('POLICY9')], orderVerified: false });
  const result = decide('suspicious login', baseAnalysis('security/unauthorized_activity', 'angry'), baseRootCause('POLICY9', 95), inv);
  assert('decision is HUMAN_ESCALATION', result.decision, 'HUMAN_ESCALATION');
}

console.log('\n[Safety Guard 2] Security intent via subIntent');
{
  const inv = baseInvestigation({ policies: [makePolicy('POLICY9')] });
  const result = decide('', baseAnalysis('account', 'neutral', { subIntent: 'unauthorized_login_or_access' }), baseRootCause('POLICY9', 80), inv);
  assert('decision is HUMAN_ESCALATION', result.decision, 'HUMAN_ESCALATION');
}

// ── Safety Guard 3: Physical verification required ───────────────────────────

console.log('\n[Safety Guard 3] Damaged product (POLICY6)');
{
  const inv = baseInvestigation({ policies: [makePolicy('POLICY6')], orderVerified: false });
  const result = decide('', baseAnalysis('product_issue', 'angry', { subIntent: 'damage' }), baseRootCause('POLICY6', 95), inv);
  assert('decision is HUMAN_ESCALATION', result.decision, 'HUMAN_ESCALATION');
}

console.log('\n[Safety Guard 3] Delivered-not-received (POLICY10)');
{
  const inv = baseInvestigation({ policies: [makePolicy('POLICY10')], orderVerified: false });
  const result = decide('', baseAnalysis('delivery', 'neutral', { subIntent: 'delivered_not_received' }), baseRootCause('POLICY10', 90), inv);
  assert('decision is HUMAN_ESCALATION', result.decision, 'HUMAN_ESCALATION');
}

// ── Safety Guard 4: No policy match ──────────────────────────────────────────

console.log('\n[Safety Guard 4] No matched policy');
{
  const inv = baseInvestigation({ policies: [] });
  const result = decide('', baseAnalysis('other/ambiguous'), baseRootCause(null, 80), inv);
  assert('decision is HUMAN_ESCALATION', result.decision, 'HUMAN_ESCALATION');
}

// ── CUSTOMER_CONFIRM: order required but not identified ───────────────────────

console.log('\n[HUMAN_ESCALATION] Refund intent, zero orders on record');
{
  const inv = baseInvestigation({ orders: [], orderVerified: false, orderInferred: false, policies: [makePolicy('POLICY3')] });
  const result = decide('I want a refund', baseAnalysis('refund/return'), baseRootCause('POLICY3', 90), inv);
  assert('decision is HUMAN_ESCALATION (zero orders)', result.decision, 'HUMAN_ESCALATION');
}

console.log('\n[HUMAN_ESCALATION] Order required + not identified + confidence 40');
{
  const order1 = { id: 'o1', customerId: CUSTOMER_ID, status: 'delivered', orderNumber: 'SR-00000001', product: 'A', amount: 100 };
  const order2 = { id: 'o2', customerId: CUSTOMER_ID, status: 'placed', orderNumber: 'SR-00000002', product: 'B', amount: 200 };
  const inv = baseInvestigation({ orders: [order1, order2], orderVerified: false, orderInferred: false, policies: [makePolicy('POLICY3')] });
  const result = decide('I want a refund', baseAnalysis('refund/return'), baseRootCause('POLICY3', 40), inv);
  assert('decision is HUMAN_ESCALATION (confidence 40, order unidentified)', result.decision, 'HUMAN_ESCALATION');
}

console.log('\n[CUSTOMER_CONFIRM] Order required + not identified + confidence 70');
{
  const order1 = { id: 'o1', customerId: CUSTOMER_ID, status: 'delivered', orderNumber: 'SR-00000001', product: 'A', amount: 100 };
  const order2 = { id: 'o2', customerId: CUSTOMER_ID, status: 'placed', orderNumber: 'SR-00000002', product: 'B', amount: 200 };
  const inv = baseInvestigation({ orders: [order1, order2], orderVerified: false, orderInferred: false, policies: [makePolicy('POLICY3')] });
  const result = decide('I want a refund', baseAnalysis('refund/return'), baseRootCause('POLICY3', 70), inv);
  assert('decision is CUSTOMER_CONFIRM (confidence 70, order unidentified)', result.decision, 'CUSTOMER_CONFIRM');
  assert('needsInfo is true', result.needsInfo, true);
}

console.log('\n[CUSTOMER_CONFIRM] Refund intent, order inferred (single order) — never AUTO_RESOLVE');
{
  const deliveredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const focusOrder = {
    id: ORDER_ID, customerId: CUSTOMER_ID, status: 'delivered',
    deliveredAt, isInTransit: false, isDelayed: false,
    returnRequested: false, returnStatus: null, orderNumber: 'SR-00000001',
    product: 'Widget', amount: 500, expectedDeliveryBy: null, statusHistory: [],
  };
  const policies = [makePolicy('POLICY3', { eligible_within_days: 10 })];
  const inv = baseInvestigation({ orders: [focusOrder], focusOrder, focusPayments: [], focusRefunds: [], orderVerified: true, orderInferred: true, policies });
  const result = decide('return request', baseAnalysis('refund/return'), baseRootCause('POLICY3', 90), inv);
  // Inferred order => must NOT AUTO_RESOLVE; should be CUSTOMER_CONFIRM
  assert('decision is CUSTOMER_CONFIRM (not AUTO_RESOLVE with inferred order)', result.decision, 'CUSTOMER_CONFIRM');
}

// ── AUTO_RESOLVE: exact match, high confidence, satisfied policy ──────────────

console.log('\n[AUTO_RESOLVE] Return received, refund eligible, exact order match');
{
  const focusOrder = {
    id: ORDER_ID, customerId: CUSTOMER_ID, status: 'returned',
    returnStatus: 'item_received_warehouse', deliveredAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    isInTransit: false, isDelayed: false, returnRequested: true, returnedAt: new Date().toISOString(),
    cancelledAt: null, cancellationReason: null, orderNumber: 'SR-00000001', product: 'Tshirt',
    amount: 800, expectedDeliveryBy: null, statusHistory: [],
  };
  const policies = [makePolicy('POLICY4')];
  const inv = baseInvestigation({
    orders: [focusOrder], focusOrder, focusPayments: [], focusRefunds: [],
    orderVerified: true, orderInferred: false, policies,
  });
  const result = decide('refund for returned item', baseAnalysis('refund/return', 'neutral', { subIntent: 'return' }), baseRootCause('POLICY4', 90), inv);
  assert('decision is AUTO_RESOLVE', result.decision, 'AUTO_RESOLVE');
  assert('confidence >= 85', result.confidence >= 85, true);
}

// ── HUMAN_ESCALATION: satisfied policy but low confidence ────────────────────

console.log('\n[HUMAN_ESCALATION] Low confidence even with satisfied policy');
{
  const focusOrder = {
    id: ORDER_ID, customerId: CUSTOMER_ID, status: 'returned',
    returnStatus: 'item_received_warehouse', deliveredAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    isInTransit: false, isDelayed: false, returnRequested: true, returnedAt: new Date().toISOString(),
    cancelledAt: null, cancellationReason: null, orderNumber: 'SR-00000001', product: 'Shirt',
    amount: 600, expectedDeliveryBy: null, statusHistory: [],
  };
  const policies = [makePolicy('POLICY4')];
  const inv = baseInvestigation({
    orders: [focusOrder], focusOrder, focusPayments: [], focusRefunds: [],
    orderVerified: true, orderInferred: false, policies,
  });
  const result = decide('refund', baseAnalysis('refund/return'), baseRootCause('POLICY4', 45), inv);
  assert('decision is HUMAN_ESCALATION (low confidence)', result.decision, 'HUMAN_ESCALATION');
}

// ── policyEngine: POLICY3 return window ──────────────────────────────────────

console.log('\n[policyEngine] POLICY3 — within return window');
{
  const deliveredAt = new Date(Date.now() - 3 * 86400000).toISOString();
  const focusOrder = {
    id: ORDER_ID, customerId: CUSTOMER_ID, status: 'delivered',
    deliveredAt, returnRequested: false, isInTransit: false, isDelayed: false,
    returnStatus: null, expectedDeliveryBy: null, statusHistory: [],
    orderNumber: 'SR-00000001', product: 'Book', amount: 250,
  };
  const policy = makePolicy('POLICY3', { eligible_within_days: 10 });
  const inv = baseInvestigation({ focusOrder, customer: { id: CUSTOMER_ID } });
  const result = evaluatePolicyConditions(policy, inv, baseAnalysis());
  assert('POLICY3 satisfied within window', result.satisfied, true);
}

console.log('\n[policyEngine] POLICY3 — outside return window (11 days > 10 day window)');
{
  const deliveredAt = new Date(Date.now() - 11 * 86400000).toISOString();
  const focusOrder = {
    id: ORDER_ID, customerId: CUSTOMER_ID, status: 'delivered',
    deliveredAt, returnRequested: false, isInTransit: false, isDelayed: false,
    returnStatus: null, expectedDeliveryBy: null, statusHistory: [],
    orderNumber: 'SR-00000001', product: 'Book', amount: 250, returnWindowDays: 10,
  };
  const policy = makePolicy('POLICY3', { eligible_within_days: 10 });
  const inv = baseInvestigation({ focusOrder, customer: { id: CUSTOMER_ID } });
  const result = evaluatePolicyConditions(policy, inv, baseAnalysis());
  assert('POLICY3 not satisfied outside window (11d)', result.satisfied, false);
}

console.log('\n[policyEngine] POLICY3 — missing deliveredAt');
{
  const focusOrder = {
    id: ORDER_ID, customerId: CUSTOMER_ID, status: 'delivered',
    deliveredAt: null, returnRequested: false,
    orderNumber: 'SR-00000001', product: 'Book', amount: 250,
  };
  const policy = makePolicy('POLICY3');
  const inv = baseInvestigation({ focusOrder, customer: { id: CUSTOMER_ID } });
  const result = evaluatePolicyConditions(policy, inv, baseAnalysis());
  assert('POLICY3 not satisfied with missing deliveredAt', result.satisfied, false);
}

console.log('\n[policyEngine] POLICY3 — 9 days -> eligible under 10-day window');
{
  const deliveredAt = new Date(Date.now() - 9 * 86400000).toISOString();
  const focusOrder = {
    id: ORDER_ID, customerId: CUSTOMER_ID, status: 'delivered',
    deliveredAt, returnRequested: false, isInTransit: false, isDelayed: false,
    returnStatus: null, expectedDeliveryBy: null, statusHistory: [],
    orderNumber: 'SR-00000001', product: 'Book', amount: 250, returnWindowDays: 10,
  };
  const policy = makePolicy('POLICY3', { eligible_within_days: 10 });
  const inv = baseInvestigation({ focusOrder, customer: { id: CUSTOMER_ID } });
  const result = evaluatePolicyConditions(policy, inv, baseAnalysis());
  assert('POLICY3 satisfied at 9 days', result.satisfied, true);
}

console.log('\n[policyEngine] POLICY3 — returnWindowDays overrides policy when stricter');
{
  const deliveredAt = new Date(Date.now() - 6 * 86400000).toISOString();
  const focusOrder = {
    id: ORDER_ID, customerId: CUSTOMER_ID, status: 'delivered',
    deliveredAt, returnRequested: false, isInTransit: false, isDelayed: false,
    returnStatus: null, expectedDeliveryBy: null, statusHistory: [],
    orderNumber: 'SR-00000001', product: 'Book', amount: 250, returnWindowDays: 5,
  };
  // Policy says 10, but SpareRoute says 5 -> min(5,10)=5, 6 > 5 -> not satisfied
  const policy = makePolicy('POLICY3', { eligible_within_days: 10 });
  const inv = baseInvestigation({ focusOrder, customer: { id: CUSTOMER_ID } });
  const result = evaluatePolicyConditions(policy, inv, baseAnalysis());
  assert('POLICY3 not satisfied when returnWindowDays (5) is stricter', result.satisfied, false);
}

console.log('\n[policyEngine] POLICY11 — in-transit and delayed');
{
  const focusOrder = {
    id: ORDER_ID, customerId: CUSTOMER_ID, status: 'out_for_delivery',
    expectedDeliveryBy: new Date(Date.now() - 2 * 86400000).toISOString(),
    isInTransit: true, isDelayed: true,
    deliveredAt: null, returnRequested: false, returnStatus: null,
    orderNumber: 'SR-00000001', product: 'Phone', amount: 5000,
  };
  const policy = makePolicy('POLICY11');
  const inv = baseInvestigation({ focusOrder, customer: { id: CUSTOMER_ID } });
  const result = evaluatePolicyConditions(policy, inv, baseAnalysis('order_status/delay'));
  assert('POLICY11 satisfied when in-transit and delayed', result.satisfied, true);
}

console.log('\n[policyEngine] POLICY11 — in-transit but NOT delayed');
{
  const focusOrder = {
    id: ORDER_ID, customerId: CUSTOMER_ID, status: 'out_for_delivery',
    expectedDeliveryBy: new Date(Date.now() + 2 * 86400000).toISOString(),
    isInTransit: true, isDelayed: false,
    deliveredAt: null, returnRequested: false,
    orderNumber: 'SR-00000001', product: 'Phone', amount: 5000,
  };
  const policy = makePolicy('POLICY11');
  const inv = baseInvestigation({ focusOrder, customer: { id: CUSTOMER_ID } });
  const result = evaluatePolicyConditions(policy, inv, baseAnalysis('order_status/delay'));
  assert('POLICY11 not satisfied when in-transit but not delayed', result.satisfied, false);
}

console.log('\n[policyEngine] POLICY1 — COD platform: always unsatisfied');
{
  const policy = makePolicy('POLICY1');
  const inv = baseInvestigation({ focusPayments: [], customer: { id: CUSTOMER_ID } });
  const result = evaluatePolicyConditions(policy, inv, baseAnalysis('payment/billing'));
  assert('POLICY1 not satisfied on COD-only platform', result.satisfied, false);
}

console.log('\n[policyEngine] POLICY7 — COD platform: no order, unsatisfied');
{
  const policy = makePolicy('POLICY7');
  const inv = baseInvestigation({ focusOrder: null, focusPayments: [], customer: { id: CUSTOMER_ID } });
  const result = evaluatePolicyConditions(policy, inv, baseAnalysis('payment/billing'));
  assert('POLICY7 not satisfied with no order', result.satisfied, false);
}

// ── spareRouteAdapter: normaliseOrderHint ────────────────────────────────────

console.log('\n[spareRouteAdapter] normaliseOrderHint');
{
  const { normaliseOrderHint } = require('../src/services/investigationEngine');
  assert('UUID is lowercased', normaliseOrderHint('ABCD1234-0000-0000-0000-000000000000'), 'abcd1234-0000-0000-0000-000000000000');
  assert('SR-1 pads to SR-00000001', normaliseOrderHint('SR-1'), 'SR-00000001');
  assert('SR 12345678 canonical', normaliseOrderHint('SR 12345678'), 'SR-12345678');
  assert('bare digits return null', normaliseOrderHint('12345'), null);
  assert('empty returns null', normaliseOrderHint(''), null);
  assert('null returns null', normaliseOrderHint(null), null);
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Decision-path tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('All tests passed \u2713');
}
