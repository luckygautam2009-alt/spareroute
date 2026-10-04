/**
 * Decision Engine: Decides the resolution path based on verified evidence,
 * policies, confidence, and category safety — NEVER sentiment alone.
 *
 * Invariants:
 * 1. Claims vs Evidence: LLM output is claim; only dataStore is evidence.
 * 2. Customer Isolation: customerId is security boundary.
 * 3. Ownership check is deterministic and mandatory: If failed => HUMAN_ESCALATION, confidence 0.
 * 4. No Fabrication: Missing evidence => HUMAN_ESCALATION with clear statement.
 * 5. Security/Unauthorized Activity: NEVER AUTO_RESOLVE under any circumstance.
 * 6. High Confidence alone NEVER triggers AUTO_RESOLVE without satisfied evidence & policy.
 * 7. AUTO_RESOLVE requires an exact (non-inferred) order match.
 */

const { evaluatePolicyConditions } = require('./policyEngine');

const PHYSICAL_VERIFICATION_INTENTS = [
  'product_issue',
  'product_quality',
];

function decide(complaintText, analysis, rootCause, investigation) {
  const { confidence, matchedPolicy } = rootCause;
  const intent = analysis.intent;
  const subIntent = analysis.subIntent;

  // SAFETY GUARD 1: Order ownership check failed (Mandatory isolation boundary)
  if (investigation && investigation.orderMismatch) {
    return {
      decision: 'HUMAN_ESCALATION',
      reasoning: `Order #${investigation.orderHintDetected} could not be verified for customer ${investigation.customer.id}. Customer isolation boundary enforced; cross-customer access is prohibited.`,
      confidence: 0,
      sentimentNote: `Note: Decision based strictly on customer order ownership verification, not sentiment (${analysis.sentiment}).`,
    };
  }

  // SAFETY GUARD 2: Security & unauthorized activity (Mandatory Escalation)
  const isSecurity =
    intent === 'security/unauthorized_activity' ||
    intent === 'account' ||
    subIntent === 'suspicious_activity' ||
    subIntent === 'account_security' ||
    subIntent === 'unauthorized_login_or_access' ||
    matchedPolicy === 'POLICY9';

  if (isSecurity) {
    return {
      decision: 'HUMAN_ESCALATION',
      reasoning: 'Security and unauthorized activity claims require mandatory manual review by Security Operations — never auto-resolved regardless of confidence score.',
      confidence,
      sentimentNote: `Note: Escalated per security policy POLICY9, not sentiment (${analysis.sentiment}).`,
    };
  }

  // SAFETY GUARD 3: Physical verification required (Damaged, wrong product, delivery dispute)
  const isPhysicalVerification =
    PHYSICAL_VERIFICATION_INTENTS.includes(intent) ||
    ['POLICY6', 'POLICY8', 'POLICY10'].includes(matchedPolicy);

  if (isPhysicalVerification) {
    const isCarrierDispute = matchedPolicy === 'POLICY10' || subIntent === 'delivered_not_received';
    return {
      decision: 'HUMAN_ESCALATION',
      reasoning: isCarrierDispute
        ? 'Carrier tracking marks delivery but customer disputes receipt. Requires logistics proof-of-delivery (POD) verification before financial resolution.'
        : 'Product condition and delivery claims rely on unverified customer claims and require photo or reverse pickup verification prior to refund.',
      confidence,
      sentimentNote: `Note: Physical verification required by policy; not sentiment (${analysis.sentiment}).`,
    };
  }

  // SAFETY GUARD 4: Policy coverage missing or ambiguous intent
  if (!matchedPolicy || intent === 'other/ambiguous') {
    return {
      decision: 'HUMAN_ESCALATION',
      reasoning: !matchedPolicy
        ? `No active policy matches intent "${intent}". Requires human support agent to review policy coverage.`
        : 'Complaint text is ambiguous or lacks verified transaction evidence; requires human review.',
      confidence,
      sentimentNote: `Note: Decision based on missing policy coverage/evidence, not sentiment (${analysis.sentiment}).`,
    };
  }

  // Order requirement check
  const orderRequired = ['payment/billing', 'payment', 'cancellation', 'refund/return', 'refund', 'order_status/delay'].includes(intent);
  const orderVerified = investigation.orderVerified && investigation.focusOrder?.customerId === investigation.customer.id;

  // CUSTOMER_CONFIRM when order is required but not exactly identified
  if (orderRequired && (!orderVerified || investigation.orderInferred)) {
    // Build list of this customer's recent orders for the questionsForCustomer
    const recentOrders = (investigation.orders || []).slice(0, 10).map((o) => ({
      orderNumber: o.orderNumber || null,
      product: o.product,
      status: o.status,
    }));

    if (!orderVerified) {
      // No order found at all (0 orders, or 2+ with no hint)
      return {
        decision: 'CUSTOMER_CONFIRM',
        reasoning: 'Order is required for this intent but could not be identified. Asking the customer to specify their order number.',
        confidence,
        needsInfo: true,
        questionsForCustomer: [
          `Could you please provide your order number (e.g. SR-00000001)? Here are your recent orders:`,
          ...recentOrders.map((o) => `  • ${o.orderNumber || 'N/A'} — ${o.product} (${o.status})`),
        ],
        sentimentNote: `Note: Decision based on missing order identification, not sentiment (${analysis.sentiment}).`,
      };
    }

    // Order was inferred (single order or "relevant" fallback) — never AUTO_RESOLVE
    // but can proceed to CUSTOMER_CONFIRM with the inferred order for confirmation
    // Fall through to policy evaluation but block AUTO_RESOLVE below
  }

  // Evaluate policy conditions using policyEngine as the single source of truth
  const policy = (investigation.policies || []).find((p) => p.id === matchedPolicy);
  let evidenceSatisfied = true;
  let policyFailureReason = '';

  if (policy) {
    const evalResult = evaluatePolicyConditions(policy, investigation, analysis);
    evidenceSatisfied = evalResult.satisfied === true;
    if (!evidenceSatisfied) {
      policyFailureReason = evalResult.reason || 'Policy conditions not satisfied by verified evidence.';
    }
  } else {
    evidenceSatisfied = false;
    policyFailureReason = `Policy ${matchedPolicy} not found in database.`;
  }

  // AUTO_RESOLVE: requires exact (non-inferred) match, high confidence, and satisfied evidence
  if (
    confidence >= 85 &&
    evidenceSatisfied &&
    (orderVerified || !orderRequired) &&
    !investigation.orderInferred
  ) {
    return {
      decision: 'AUTO_RESOLVE',
      reasoning: `High confidence (${confidence}%) and verified evidence satisfies policy ${matchedPolicy} conditions for customer ${investigation.customer.id}. Safe for automated resolution.`,
      confidence,
      sentimentNote: `Note: Decision based strictly on verified records and policy criteria, not sentiment (${analysis.sentiment}).`,
    };
  }

  // Medium confidence or needs customer approval
  if (confidence >= 60 && evidenceSatisfied) {
    return {
      decision: 'CUSTOMER_CONFIRM',
      reasoning: `Verified records match policy ${matchedPolicy} with ${confidence}% confidence, but customer confirmation is recommended before finalizing.`,
      confidence,
      sentimentNote: `Note: Decision based on policy requirements, not sentiment (${analysis.sentiment}).`,
    };
  }

  // Otherwise, escalate
  return {
    decision: 'HUMAN_ESCALATION',
    reasoning: policyFailureReason
      ? `${policyFailureReason} Insufficient verified evidence to auto-resolve.`
      : `Confidence score (${confidence}%) below automation threshold or evidence incomplete. Requires human investigation.`,
    confidence,
    sentimentNote: `Note: Decision based on verified evidence completeness, not sentiment (${analysis.sentiment}).`,
  };
}

module.exports = { decide };
