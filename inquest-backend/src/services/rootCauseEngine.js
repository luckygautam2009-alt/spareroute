const { generateJSON } = require('./geminiService');
const { matchPolicyForIntent, evaluatePolicyConditions } = require('./policyEngine');

function buildDeterministicRootCause(investigation, analysis) {
  const { customer, focusOrder, focusPayments, refunds, securityEvents } = investigation;
  const policy = matchPolicyForIntent(analysis, investigation);

  if (!policy) {
    if (analysis.intent === 'other/ambiguous') {
      return {
        rootCause: 'Unable to determine root cause from available customer data: Ambiguous complaint with no matching policy.',
        evidenceUsed: ['Complaint text lacks specific actionable claims or verifiable transaction references'],
        matchedPolicy: null,
        confidence: 25,
        confidenceReasoning: 'Ambiguous complaint with no matching policy; requires human review.',
        source: 'evidence',
      };
    }
    return {
      rootCause: `Understood intent "${analysis.intent}" (${analysis.subIntent || 'general'}), but no matching automated policy exists in the system. Policy coverage is missing.`,
      evidenceUsed: [`Intent identified as ${analysis.intent}`, 'No applicable policy registered in policy database'],
      matchedPolicy: null,
      confidence: 30,
      confidenceReasoning: 'No policy registered for this category; must escalate to human agent.',
      source: 'evidence',
    };
  }

  const evalResult = evaluatePolicyConditions(policy, investigation, analysis);

  // Security
  if (policy.id === 'POLICY9') {
    const flagged = (securityEvents || []).filter((s) => s.customerId === customer.id && s.flagged);
    if (flagged.length > 0) {
      return {
        rootCause: `Suspicious activity detected for ${customer.id}: ${flagged.length} flagged security event(s) recorded, including ${flagged[0].eventType} from IP ${flagged[0].ip} (${flagged[0].location || 'unknown'}).`,
        evidenceUsed: evalResult.evidenceUsed,
        matchedPolicy: policy.id,
        confidence: 90,
        confidenceReasoning: 'Verified security logs show unauthorized access attempts; requires mandatory security escalation.',
        source: 'evidence',
      };
    }
    return {
      rootCause: `No unauthorized login or suspicious security events recorded in system logs for customer ${customer.id}. Unable to determine root cause from available customer data.`,
      evidenceUsed: ['Customer security audit logs show zero flagged access events'],
      matchedPolicy: policy.id,
      confidence: 35,
      confidenceReasoning: 'Claim of unauthorized activity has no corroborating security event in backend logs.',
      source: 'evidence',
    };
  }

  // Duplicate Payment
  if (policy.id === 'POLICY7') {
    if (evalResult.satisfied) {
      const pays = evalResult.details.duplicatePayments;
      return {
        rootCause: `Verified duplicate payment on ${focusOrder.id} for customer ${customer.id}: ${pays.join(' and ')} both exist against the same order (amount ₹${focusOrder.amount}).`,
        evidenceUsed: evalResult.evidenceUsed,
        matchedPolicy: policy.id,
        confidence: 94,
        confidenceReasoning: 'Multiple successful payment transactions verified in gateway for a single order.',
        source: 'evidence',
      };
    }
    return {
      rootCause: 'Unable to determine root cause from available customer data: Insufficient verified payment evidence to establish duplicate transaction.',
      evidenceUsed: evalResult.reason ? [evalResult.reason] : ['Payment logs do not confirm multiple debits'],
      matchedPolicy: null,
      confidence: 20,
      confidenceReasoning: 'Evidence did not satisfy duplicate payment conditions.',
      source: 'evidence',
    };
  }

  // Failed Payment with Deducted Amount
  if (policy.id === 'POLICY1') {
    if (evalResult.satisfied) {
      return {
        rootCause: `Payment gateway debited funds successfully for customer ${customer.id}, but local order fulfillment recorded transaction as failed.`,
        evidenceUsed: evalResult.evidenceUsed,
        matchedPolicy: policy.id,
        confidence: 91,
        confidenceReasoning: 'Reconciliation mismatch between gateway success and local failure.',
        source: 'evidence',
      };
    }
    return {
      rootCause: 'Unable to determine root cause from available customer data: No mismatched payment records found for this customer.',
      evidenceUsed: ['All payment records match their local status'],
      matchedPolicy: null,
      confidence: 20,
      confidenceReasoning: 'No gateway vs local discrepancy detected.',
      source: 'evidence',
    };
  }

  // Refund Pending
  if (policy.id === 'POLICY2') {
    if (evalResult.satisfied) {
      const ref = evalResult.details.refund;
      return {
        rootCause: `Refund ${ref.id} of ₹${ref.amount} was initiated on ${ref.initiatedAt.slice(0, 10)} and is currently in "pending" status awaiting banking network settlement (gateway ref: ${ref.gatewayRef || 'N/A'}).`,
        evidenceUsed: evalResult.evidenceUsed,
        matchedPolicy: policy.id,
        confidence: 92,
        confidenceReasoning: 'Verified active refund record exists in pending status within normal settlement window.',
        source: 'evidence',
      };
    }
    return {
      rootCause: 'Unable to determine root cause from available customer data: No initiated or pending refund record found in system.',
      evidenceUsed: ['Zero pending refund transactions recorded in refund database'],
      matchedPolicy: null,
      confidence: 25,
      confidenceReasoning: 'No refund transaction exists in records.',
      source: 'evidence',
    };
  }

  // Return Received Refund Eligibility (Return exists but refund record missing or needs release)
  if (policy.id === 'POLICY4') {
    if (evalResult.satisfied) {
      return {
        rootCause: `Order ${focusOrder.id} was returned and physically received at the logistics facility (${focusOrder.returnStatus || 'returned'}), but refund has not yet been processed. Customer is fully eligible for refund.`,
        evidenceUsed: evalResult.evidenceUsed,
        matchedPolicy: policy.id,
        confidence: 88,
        confidenceReasoning: 'Warehouse receipt confirmed; refund creation pending.',
        source: 'evidence',
      };
    }
    return {
      rootCause: 'Unable to determine root cause from available customer data: Order has not been received by warehouse for return.',
      evidenceUsed: ['No warehouse return receipt logged'],
      matchedPolicy: null,
      confidence: 20,
      confidenceReasoning: 'Return status not verified.',
      source: 'evidence',
    };
  }

  // Return & Exchange
  if (policy.id === 'POLICY3') {
    if (evalResult.satisfied) {
      return {
        rootCause: `Order ${focusOrder.id} was delivered on ${focusOrder.deliveredAt || focusOrder.deliveredOn} and is within the 10-day return/exchange window (${evalResult.details.daysDiff} days elapsed).`,
        evidenceUsed: evalResult.evidenceUsed,
        matchedPolicy: policy.id,
        confidence: 89,
        confidenceReasoning: 'Delivery date verified within return eligibility window.',
        source: 'evidence',
      };
    }
    return {
      rootCause: `Return window expired or order ineligible for return under policy: ${evalResult.reason || 'Not delivered or outside return window'}.`,
      evidenceUsed: [evalResult.reason || 'Exceeds return timeframe'],
      matchedPolicy: policy.id,
      confidence: 65,
      confidenceReasoning: 'Verified delivery timestamp is outside policy return allowance.',
      source: 'evidence',
    };
  }

  // Cancellation
  if (policy.id === 'POLICY5') {
    if (evalResult.satisfied) {
      const reason = evalResult.details.cancellationReason;
      const reasonText = reason
        ? `Cancellation reason recorded in system: "${reason}".`
        : 'Order was cancelled, but the specific cancellation reason was not recorded in order history.';
      return {
        rootCause: `Order ${focusOrder.id} was cancelled on ${focusOrder.cancelledAt ? focusOrder.cancelledAt.slice(0, 10) : 'prior date'}. ${reasonText}`,
        evidenceUsed: evalResult.evidenceUsed,
        matchedPolicy: policy.id,
        confidence: 90,
        confidenceReasoning: 'Verified order cancellation record in dataStore.',
        source: 'evidence',
      };
    }
    return {
      rootCause: 'Unable to determine root cause from available customer data: Order is not recorded as cancelled in backend systems.',
      evidenceUsed: ['Order status in database is active, not cancelled'],
      matchedPolicy: null,
      confidence: 25,
      confidenceReasoning: 'Order record does not indicate cancellation.',
      source: 'evidence',
    };
  }

  // In-Transit Order Status & Delay (POLICY11)
  if (policy.id === 'POLICY11') {
    if (evalResult.satisfied) {
      return {
        rootCause: `Order ${focusOrder.id} is currently in transit with logistics carrier (carrier tracking: ${focusOrder.courierTracking || 'N/A'}, status: ${focusOrder.courierStatus || 'in transit'}, estimated delivery: ${focusOrder.estimatedDelivery || 'in 2-3 business days'}).`,
        evidenceUsed: evalResult.evidenceUsed,
        matchedPolicy: policy.id,
        confidence: 90,
        confidenceReasoning: 'Verified live shipping and dispatch status in carrier records.',
        source: 'evidence',
      };
    }
    return {
      rootCause: 'Unable to determine root cause from available customer data: Order is not in transit.',
      evidenceUsed: ['Order is not in transit in database records'],
      matchedPolicy: null,
      confidence: 25,
      confidenceReasoning: 'No active shipment in transit.',
      source: 'evidence',
    };
  }

  // Product issues (Damaged, Wrong item, Delivered not received)
  if (['POLICY6', 'POLICY8', 'POLICY10'].includes(policy.id)) {
    if (evalResult.satisfied) {
      let specificCause = '';
      if (policy.id === 'POLICY10') {
        specificCause = `Tracking shows parcel delivered for Order ${focusOrder.id} (courier: ${focusOrder.courierTracking || 'partner'}), but customer reports non-receipt. Requires courier proof-of-delivery (POD) investigation.`;
      } else if (policy.id === 'POLICY6') {
        specificCause = `Customer reported damaged product for Order ${focusOrder.id}. Per policy, physical damage claims rely on customer claims and require photo verification before resolution.`;
      } else {
        specificCause = `Customer reported wrong product delivered for Order ${focusOrder.id}. Requires warehouse dispatch log comparison and return pickup verification.`;
      }
      return {
        rootCause: specificCause,
        evidenceUsed: evalResult.evidenceUsed,
        matchedPolicy: policy.id,
        confidence: 75,
        confidenceReasoning: 'Customer claim requires physical or logistics partner verification prior to automated action.',
        source: 'evidence',
      };
    }
  }

  return {
    rootCause: 'Unable to determine root cause from available customer data: Insufficient verified evidence.',
    evidenceUsed: ['System records do not contain sufficient evidence to substantiate the claim'],
    matchedPolicy: null,
    confidence: 15,
    confidenceReasoning: 'No verified backend records align with the customer claim.',
    source: 'evidence',
  };
}

async function findRootCause(complaintText, analysis, investigation) {
  // Invariant 2 & 3: Mandatory deterministic ownership check
  if (investigation.orderMismatch) {
    return {
      rootCause: `Order #${investigation.orderHintDetected} could not be verified for customer ${investigation.customer.id}. The order does not exist in this customer's records.`,
      evidenceUsed: [`Customer ${investigation.customer.id} has no order matching #${investigation.orderHintDetected}`],
      matchedPolicy: null,
      confidence: 0,
      confidenceReasoning: `Order #${investigation.orderHintDetected} does not belong to customer ${investigation.customer.id}. Data from another customer is never evidence.`,
      source: 'investigation',
    };
  }

  // If customer has no orders and complaint claims order issues
  if (
    (!investigation.orders || investigation.orders.length === 0) &&
    ['payment/billing', 'payment', 'refund/return', 'refund', 'cancellation', 'product_issue', 'order_status/delay'].includes(analysis.intent)
  ) {
    return {
      rootCause: 'Unable to determine root cause from available customer data: Customer has no order history on file.',
      evidenceUsed: [`Customer ${investigation.customer.id} has 0 orders in database`],
      matchedPolicy: null,
      confidence: 10,
      confidenceReasoning: 'No verified orders found for customer in dataStore.',
      source: 'investigation',
    };
  }

  // Deterministic evidence-backed root cause
  const deterministicResult = buildDeterministicRootCause(investigation, analysis);

  if (deterministicResult.confidence >= 80 || deterministicResult.matchedPolicy === 'POLICY9') {
    return deterministicResult;
  }

  try {
    const evidenceSummary = {
      customerId: investigation.customer.id,
      customerName: investigation.customer.name,
      focusOrder: investigation.focusOrder,
      focusPayments: investigation.focusPayments,
      focusRefunds: investigation.focusRefunds,
      priorTickets: investigation.tickets,
      securityEvents: investigation.securityEvents,
    };

    const prompt = `You are the Root Cause Engine of an AI customer support investigation system.
STRICT ACCURACY RULES:
- Reason ONLY from verified evidence. Do NOT fabricate orders, amounts, cancellation reasons, or login events.
- If evidence is missing, state "Unable to determine root cause from available customer data".
- Output JSON ONLY.

Complaint: "${complaintText}"
Intent: ${JSON.stringify(analysis)}
Evidence: ${JSON.stringify(evidenceSummary)}

Structure:
{
  "rootCause": "explanation referencing verified records or missing evidence",
  "evidenceUsed": ["short evidence items"],
  "matchedPolicy": "POLICY ID or null",
  "confidence": <0-100>,
  "confidenceReasoning": "reasoning"
}`;

    const aiRes = await generateJSON(prompt);
    if (aiRes && aiRes.rootCause) {
      return {
        rootCause: aiRes.rootCause,
        evidenceUsed: Array.isArray(aiRes.evidenceUsed) && aiRes.evidenceUsed.length > 0 ? aiRes.evidenceUsed : deterministicResult.evidenceUsed,
        matchedPolicy: aiRes.matchedPolicy || deterministicResult.matchedPolicy,
        confidence: typeof aiRes.confidence === 'number' ? aiRes.confidence : deterministicResult.confidence,
        confidenceReasoning: aiRes.confidenceReasoning || deterministicResult.confidenceReasoning,
        source: 'ai',
      };
    }
  } catch (err) {
    console.warn('[rootCauseEngine] AI enrichment skipped, using deterministic root cause:', err.message);
  }

  return deterministicResult;
}

module.exports = {
  findRootCause,
  buildDeterministicRootCause,
};
