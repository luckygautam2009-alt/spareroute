/**
 * Builds the final output shown to either the agent (escalation) or
 * the customer/system (auto-resolve or confirm action).
 * Pure formatting — no AI call needed.
 */
function buildHandoff(investigation, rootCause, decision) {
  const base = {
    customerName: investigation.customer.name,
    customerTier: investigation.customer.tier,
    customerId: investigation.customer.id,
    orderId: investigation.focusOrder ? investigation.focusOrder.id : null,
    rootCause: rootCause.rootCause,
    confidence: rootCause.confidence,
    matchedPolicy: rootCause.matchedPolicy,
  };

  const policyId = rootCause.matchedPolicy;

  if (decision.decision === 'AUTO_RESOLVE') {
    let actionTaken = 'Resolution applied automatically';
    if (policyId === 'POLICY7') {
      actionTaken = `Duplicate payment refund of ₹${investigation.focusOrder?.amount ?? 'N/A'} initiated to original payment method under policy ${policyId}`;
    } else if (policyId === 'POLICY1') {
      actionTaken = `Reconciliation refund of ₹${investigation.focusOrder?.amount ?? 'N/A'} initiated for debited failed transaction under policy ${policyId}`;
    } else if (policyId === 'POLICY2') {
      actionTaken = `Verified active refund in banking queue (ARN/Reference confirmed) under policy ${policyId}`;
    } else if (policyId === 'POLICY4') {
      actionTaken = `Return warehouse receipt verified; refund of ₹${investigation.focusOrder?.amount ?? 'N/A'} initiated under policy ${policyId}`;
    } else if (policyId === 'POLICY5') {
      actionTaken = `Order cancellation and reason confirmed from backend records under policy ${policyId}`;
    } else if (policyId === 'POLICY11') {
      actionTaken = `Live carrier dispatch tracking and expected delivery status provided under policy ${policyId}`;
    } else if (policyId) {
      actionTaken = `Automated resolution executed under policy ${policyId}`;
    }

    return {
      ...base,
      type: 'AUTO_RESOLVE',
      actionTaken,
      customerMessage: `Hi ${investigation.customer.name}, we investigated your complaint: ${rootCause.rootCause}`,
    };
  }

  if (decision.decision === 'CUSTOMER_CONFIRM') {
    let suggestedAction = 'Suggested resolution pending customer approval';
    if (policyId === 'POLICY3') {
      suggestedAction = `Schedule return pickup for order ${investigation.focusOrder?.id || ''} within 10-day return window`;
    } else if (policyId) {
      suggestedAction = `Execute policy ${policyId} resolution awaiting customer confirmation`;
    }

    return {
      ...base,
      type: 'CUSTOMER_CONFIRM',
      suggestedAction,
      customerMessage: `Hi ${investigation.customer.name}, we investigated your account: ${rootCause.rootCause}. Would you like us to proceed with this resolution?`,
    };
  }

  // HUMAN_ESCALATION
  let recommendedAction = 'Manual investigation required by support team';
  if (investigation.orderMismatch) {
    recommendedAction = `Verify order number with customer ${investigation.customer.name} — referenced order #${investigation.orderHintDetected} does not exist in their account history`;
  } else if (policyId === 'POLICY9') {
    recommendedAction = 'Immediately review flagged IP/device access in Security Ops console and lock compromised sessions if verified';
  } else if (policyId === 'POLICY10') {
    recommendedAction = 'Contact logistics delivery partner to obtain signed Proof of Delivery (POD) image and courier delivery driver statement';
  } else if (policyId === 'POLICY6') {
    recommendedAction = 'Request customer provide clear photos of package damage and shipping label before initiating replacement';
  } else if (policyId === 'POLICY8') {
    recommendedAction = 'Compare delivered item details against warehouse outbound scan logs and initiate reverse pickup';
  } else if (policyId) {
    recommendedAction = `Review customer records and evaluate under policy ${policyId}`;
  }

  return {
    ...base,
    type: 'HUMAN_ESCALATION',
    agentSummary: {
      issue: investigation.orderMismatch
        ? `Customer/order mismatch: Order #${investigation.orderHintDetected} not found for customer ${investigation.customer.id}`
        : (investigation.orderHintDetected ? `Issue related to order #${investigation.orderHintDetected}` : `${rootCause.rootCause.slice(0, 100)}...`),
      rootCause: rootCause.rootCause,
      evidenceUsed: rootCause.evidenceUsed,
      actionsAlreadyTaken: ['Customer isolated', 'Verified backend evidence gathered', 'Policy evaluated'],
      recommendedAction,
      confidence: rootCause.confidence,
    },
  };
}

module.exports = { buildHandoff };
