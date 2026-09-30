/**
 * Transforms investigation + rootCause + decision into a generic
 * node/edge graph structure for frontend visualization (React Flow, D3, etc).
 * No AI call — pure formatting of already-computed evidence.
 */
function buildEvidenceGraph(investigation, rootCause, decision) {
  const nodes = [];
  const edges = [];
  let order = 0;

  function addNode(id, type, label, status, data = {}) {
    nodes.push({ id, type, label, status, order: order++, data });
    return id;
  }
  function addEdge(from, to) {
    edges.push({ id: `${from}->${to}`, source: from, target: to });
  }

  // 1. Complaint (root node)
  const complaintId = addNode('complaint', 'complaint', 'Customer Complaint', 'found');
  let lastId = complaintId;

  // 2. Prior tickets (if any)
  (investigation.tickets || []).forEach((ticket) => {
    const id = `ticket-${ticket.id}`;
    addNode(id, 'ticket', `Previous Ticket: ${ticket.subject}`, 'found', ticket);
    addEdge(lastId, id);
    lastId = id;
  });

  // 3. Security events (if any)
  (investigation.securityEvents || []).forEach((sec) => {
    const id = `security-${sec.id}`;
    addNode(
      id,
      'security',
      `Security Event: ${sec.eventType} (${sec.location || 'unknown'})`,
      sec.flagged ? 'flagged' : 'verified',
      sec
    );
    addEdge(lastId, id);
    lastId = id;
  });

  // 4. Focus payments
  (investigation.focusPayments || []).forEach((payment) => {
    const id = `payment-${payment.id}`;
    const mismatch = payment.gatewayStatus !== payment.localStatus;
    addNode(
      id,
      'payment',
      `Payment ${payment.id}`,
      mismatch ? 'flagged' : 'verified',
      payment
    );
    addEdge(lastId, id);
    lastId = id;
  });

  // 5. Focus refunds (if any)
  (investigation.focusRefunds || []).forEach((refund) => {
    const id = `refund-${refund.id}`;
    addNode(
      id,
      'refund',
      `Refund ${refund.id} (₹${refund.amount})`,
      refund.status === 'pending' ? 'flagged' : 'verified',
      refund
    );
    addEdge(lastId, id);
    lastId = id;
  });

  // 6. Focus order
  if (investigation.focusOrder) {
    const id = `order-${investigation.focusOrder.id}`;
    addNode(id, 'order', `Order ${investigation.focusOrder.id}`, 'found', investigation.focusOrder);
    addEdge(lastId, id);
    lastId = id;
  }

  // 7. Matched policy
  if (rootCause.matchedPolicy) {
    const policy = (investigation.policies || []).find((p) => p.id === rootCause.matchedPolicy);
    const id = `policy-${rootCause.matchedPolicy}`;
    addNode(id, 'policy', policy ? policy.title : rootCause.matchedPolicy, 'matched', policy || {});
    addEdge(lastId, id);
    lastId = id;
  }

  // 8. Root cause
  const rootCauseId = addNode('root-cause', 'rootCause', 'Root Cause', 'analyzed', {
    rootCause: rootCause.rootCause,
    confidence: rootCause.confidence,
  });
  addEdge(lastId, rootCauseId);

  // 9. Recommended action / decision
  const actionId = addNode('recommended-action', 'action', 'Recommended Action', decision.decision, {
    decision: decision.decision,
    reasoning: decision.reasoning,
  });
  addEdge(rootCauseId, actionId);

  return { nodes, edges };
}

module.exports = { buildEvidenceGraph };
