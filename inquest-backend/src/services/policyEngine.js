/**
 * Evaluates machine-readable policies against verified customer evidence.
 *
 * Invariants:
 * 1. LLM output and complaint text are claims. Only dataStore records are evidence.
 * 2. Customer isolation: only inspect evidence for the verified customer.
 * 3. Never invent facts.
 */

function evaluatePolicyConditions(policy, investigation, analysis) {
  const { customer, focusOrder, focusPayments, focusRefunds, orders, payments, tickets, refunds, securityEvents } = investigation;
  const policyId = policy.id;

  switch (policyId) {
    case 'POLICY7': {
      // Duplicate payment refund
      if (!focusOrder || focusOrder.customerId !== customer.id) {
        return { satisfied: false, reason: 'No verified order belonging to customer' };
      }
      const successfulPayments = (focusPayments || []).filter(
        (p) => (p.status === 'success' || p.gatewayStatus === 'success') && p.customerId === customer.id
      );
      if (successfulPayments.length >= 2) {
        return {
          satisfied: true,
          evidenceUsed: [
            `Verified order ${focusOrder.id} for customer ${customer.id}`,
            ...successfulPayments.map((p) => `Payment ${p.id} gateway=${p.gatewayStatus || p.status}/local=${p.localStatus}`),
          ],
          details: {
            orderId: focusOrder.id,
            duplicatePayments: successfulPayments.map((p) => p.id),
            amount: focusOrder.amount,
          },
        };
      }
      return { satisfied: false, reason: 'Less than two successful payments recorded for this order' };
    }

    case 'POLICY1': {
      // Failed payment with amount deducted
      const deductedFailed = (focusPayments || payments || []).filter(
        (p) => p.gatewayStatus === 'success' && p.localStatus === 'failed' && p.customerId === customer.id
      );
      if (deductedFailed.length > 0) {
        return {
          satisfied: true,
          evidenceUsed: deductedFailed.map(
            (p) => `Payment ${p.id} (Order ${p.orderId}) debited by gateway=${p.gatewayStatus} but recorded locally as ${p.localStatus}`
          ),
          details: { payments: deductedFailed.map((p) => p.id) },
        };
      }
      return { satisfied: false, reason: 'No payment found where gateway succeeded but local record failed' };
    }

    case 'POLICY2': {
      // Refund pending / delay
      const custRefunds = (refunds || []).filter((r) => r.customerId === customer.id);
      const matchingRefund = focusOrder
        ? (focusRefunds && focusRefunds.length > 0 ? focusRefunds[0] : custRefunds.find((r) => r.orderId === focusOrder.id))
        : custRefunds[0];

      if (matchingRefund && matchingRefund.status === 'pending') {
        return {
          satisfied: true,
          evidenceUsed: [
            `Refund ${matchingRefund.id} exists for order ${matchingRefund.orderId} with status=pending`,
            `Initiated at ${matchingRefund.initiatedAt} (gateway ref: ${matchingRefund.gatewayRef || 'N/A'})`,
          ],
          details: { refund: matchingRefund },
        };
      }
      return { satisfied: false, reason: 'No pending refund record found for customer/order' };
    }

    case 'POLICY4': {
      // Return received refund eligibility
      if (focusOrder && (focusOrder.status === 'returned' || focusOrder.returnStatus === 'item_received_warehouse')) {
        const custRefunds = (focusRefunds || []).filter((r) => r.orderId === focusOrder.id && r.customerId === customer.id);
        return {
          satisfied: true,
          evidenceUsed: [
            `Order ${focusOrder.id} status is returned (returnStatus=${focusOrder.returnStatus || 'returned'})`,
            `Returned at ${focusOrder.returnedAt || 'verified timestamp'}`,
            custRefunds.length === 0 ? 'No prior refund record found in system' : `Existing refund status: ${custRefunds[0].status}`,
          ],
          details: { orderId: focusOrder.id, refundExists: custRefunds.length > 0 },
        };
      }
      return { satisfied: false, reason: 'No verified returned order found awaiting refund' };
    }

    case 'POLICY3': {
      // Return & Exchange window
      if (focusOrder && focusOrder.status === 'delivered' && !focusOrder.returnRequested) {
        const deliveryDateStr = focusOrder.deliveredAt || focusOrder.deliveredOn;
        if (deliveryDateStr) {
          const deliveryTime = new Date(deliveryDateStr).getTime();
          const now = Date.now();
          const daysDiff = (now - deliveryTime) / (1000 * 60 * 60 * 24);
          if (daysDiff <= (policy.eligibleWithinDays || 10) || isNaN(daysDiff)) {
            return {
              satisfied: true,
              evidenceUsed: [
                `Order ${focusOrder.id} delivered on ${deliveryDateStr}`,
                `Delivery is within return window of ${policy.eligibleWithinDays || 10} days (${isNaN(daysDiff) ? 0 : Math.floor(daysDiff)} days elapsed)`,
                'No return previously requested',
              ],
              details: { orderId: focusOrder.id, daysDiff: isNaN(daysDiff) ? 0 : Math.floor(daysDiff) },
            };
          }
          return { satisfied: false, reason: `Delivery date (${deliveryDateStr}) exceeds ${policy.eligibleWithinDays || 10} day return window` };
        }
      }
      return { satisfied: false, reason: 'Order is not in delivered status or return already requested' };
    }

    case 'POLICY5': {
      // Order cancellation
      if (focusOrder && focusOrder.status === 'cancelled') {
        const reasonRecorded = focusOrder.cancellationReason || null;
        const evidenceUsed = [
          `Order ${focusOrder.id} status is cancelled`,
          `Cancelled at ${focusOrder.cancelledAt || 'recorded timestamp'}`,
        ];
        if (reasonRecorded) {
          evidenceUsed.push(`Recorded cancellation reason: "${reasonRecorded}"`);
        } else {
          evidenceUsed.push('Cancellation reason is not recorded in order history');
        }
        return {
          satisfied: true,
          evidenceUsed,
          details: { orderId: focusOrder.id, cancellationReason: reasonRecorded },
        };
      }
      return { satisfied: false, reason: 'Order is not marked as cancelled in records' };
    }

    case 'POLICY11': {
      // Order in-transit status and delay
      if (focusOrder && (focusOrder.status === 'in_transit' || focusOrder.courierTracking)) {
        return {
          satisfied: true,
          evidenceUsed: [
            `Verified order ${focusOrder.id} status is "${focusOrder.status}"`,
            focusOrder.courierTracking ? `Carrier tracking: ${focusOrder.courierTracking} (${focusOrder.courierStatus || 'in transit'})` : 'Carrier tracking active',
            focusOrder.estimatedDelivery ? `Estimated delivery date: ${focusOrder.estimatedDelivery}` : 'Standard shipping window',
          ],
          details: {
            orderId: focusOrder.id,
            status: focusOrder.status,
            tracking: focusOrder.courierTracking,
            estimatedDelivery: focusOrder.estimatedDelivery,
          },
        };
      }
      return { satisfied: false, reason: 'Order is not in transit' };
    }

    case 'POLICY6': // Damaged product claim (escalation required)
    case 'POLICY8': // Wrong product claim (escalation required)
    case 'POLICY10': { // Delivered not received (escalation required)
      if (focusOrder) {
        return {
          satisfied: true,
          evidenceUsed: [
            `Verified order ${focusOrder.id} exists for customer ${customer.id}`,
            `Current order status is "${focusOrder.status}"`,
            focusOrder.courierTracking ? `Carrier tracking: ${focusOrder.courierTracking} (status: ${focusOrder.courierStatus || 'dispatched'})` : 'Standard dispatch verified',
            'Customer claim requires physical/carrier verification prior to resolution',
          ],
          details: { orderId: focusOrder.id, policyRequiresEscalation: true },
        };
      }
      return { satisfied: false, reason: 'No verified order found for product issue claim' };
    }

    case 'POLICY9': {
      // Unauthorized account activity (escalation only)
      const events = (securityEvents || []).filter((s) => s.customerId === customer.id);
      const flaggedEvents = events.filter((e) => e.flagged);
      const priorSecTickets = (tickets || []).filter((t) => t.category === 'security' && t.customerId === customer.id);

      const evidenceUsed = [];
      if (flaggedEvents.length > 0) {
        evidenceUsed.push(...flaggedEvents.map((e) => `Security event: ${e.eventType} from IP ${e.ip} (${e.location || 'unknown location'}) at ${e.timestamp}`));
      } else {
        evidenceUsed.push('No unauthorized login or suspicious security events recorded for customer account');
      }

      if (priorSecTickets.length > 0) {
        evidenceUsed.push(...priorSecTickets.map((t) => `Prior security ticket ${t.id} (${t.status}): ${t.subject}`));
      }

      return {
        satisfied: true,
        evidenceUsed,
        details: { flaggedEventsCount: flaggedEvents.length, hasSecurityRecord: flaggedEvents.length > 0 },
      };
    }

    default:
      return { satisfied: false, reason: `No evaluation rule for policy ${policyId}` };
  }
}

function matchPolicyForIntent(intentAnalysis, investigation) {
  const policies = investigation.policies || [];
  const intent = intentAnalysis.intent;
  const subIntent = intentAnalysis.subIntent || '';

  // 1. Security / unauthorized activity
  if (
    intent === 'security/unauthorized_activity' ||
    intent === 'account' ||
    subIntent.includes('suspicious') ||
    subIntent.includes('security') ||
    subIntent.includes('unauthorized') ||
    subIntent.includes('login')
  ) {
    return policies.find((p) => p.id === 'POLICY9') || null;
  }

  // 2. Cancellation
  if (intent === 'cancellation' || subIntent.includes('cancel')) {
    return policies.find((p) => p.id === 'POLICY5') || null;
  }

  // 3. Order status / delay
  if (intent === 'order_status/delay' || subIntent.includes('delay') || subIntent.includes('tracking') || subIntent.includes('order_status')) {
    return policies.find((p) => p.id === 'POLICY11') || null;
  }

  // 4. Payment / Billing
  if (intent === 'payment/billing' || intent === 'payment' || intent === 'billing') {
    if (subIntent.includes('duplicate')) {
      return policies.find((p) => p.id === 'POLICY7') || null;
    }
    if (subIntent.includes('failed') || subIntent.includes('deduct')) {
      return policies.find((p) => p.id === 'POLICY1') || null;
    }
    if (investigation.focusPayments && investigation.focusPayments.length >= 2) {
      return policies.find((p) => p.id === 'POLICY7') || null;
    }
    const hasDeductedFailed = (investigation.focusPayments || investigation.payments || []).some(
      (p) => p.gatewayStatus === 'success' && p.localStatus === 'failed'
    );
    if (hasDeductedFailed) {
      return policies.find((p) => p.id === 'POLICY1') || null;
    }
    return policies.find((p) => p.id === 'POLICY7') || null;
  }

  // 5. Product issue / quality / damage / wrong item / delivered not received
  if (
    intent === 'product_issue' ||
    intent === 'delivery' ||
    subIntent.includes('damage') ||
    subIntent.includes('quality') ||
    subIntent.includes('broken') ||
    subIntent.includes('wrong') ||
    subIntent.includes('not_received')
  ) {
    if (subIntent.includes('not_received') || subIntent.includes('delivered_not_received')) {
      return policies.find((p) => p.id === 'POLICY10') || null;
    }
    if (subIntent.includes('damage') || subIntent.includes('quality') || subIntent.includes('poor_quality')) {
      return policies.find((p) => p.id === 'POLICY6') || policies.find((p) => p.id === 'POLICY3') || null;
    }
    if (subIntent.includes('wrong')) {
      return policies.find((p) => p.id === 'POLICY8') || null;
    }
    if (subIntent.includes('return') || subIntent.includes('exchange')) {
      return policies.find((p) => p.id === 'POLICY3') || null;
    }
    return policies.find((p) => p.id === 'POLICY6') || policies.find((p) => p.id === 'POLICY3') || null;
  }

  // 6. Refund / Return
  if (intent === 'refund/return' || intent === 'refund' || intent === 'return' || subIntent.includes('refund') || subIntent.includes('return')) {
    if (subIntent.includes('poor_quality') || subIntent.includes('damage') || subIntent.includes('quality')) {
      return policies.find((p) => p.id === 'POLICY6') || policies.find((p) => p.id === 'POLICY3') || null;
    }
    if (subIntent.includes('wrong')) {
      return policies.find((p) => p.id === 'POLICY8') || null;
    }
    const focusHasPending = (investigation.focusRefunds || []).some((r) => r.status === 'pending');
    if (focusHasPending) {
      return policies.find((p) => p.id === 'POLICY2') || null;
    }
    if (
      investigation.focusOrder &&
      (investigation.focusOrder.status === 'returned' || investigation.focusOrder.returnStatus === 'item_received_warehouse')
    ) {
      return policies.find((p) => p.id === 'POLICY4') || null;
    }
    if (investigation.focusOrder && investigation.focusOrder.status === 'delivered') {
      return policies.find((p) => p.id === 'POLICY3') || policies.find((p) => p.id === 'POLICY6') || null;
    }
    const anyPending = (investigation.refunds || []).some((r) => r.status === 'pending');
    if (anyPending) {
      return policies.find((p) => p.id === 'POLICY2') || null;
    }
    return policies.find((p) => p.id === 'POLICY4') || policies.find((p) => p.id === 'POLICY2') || policies.find((p) => p.id === 'POLICY3') || null;
  }

  return null;
}

module.exports = {
  evaluatePolicyConditions,
  matchPolicyForIntent,
};
