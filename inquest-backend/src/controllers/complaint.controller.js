const { randomUUID } = require('crypto');
const { analyzeComplaint } = require('../services/intentEngine');
const { investigate } = require('../services/investigationEngine');
const { findRootCause } = require('../services/rootCauseEngine');
const { decide } = require('../services/decisionEngine');
const { buildHandoff } = require('../services/handoffEngine');
const { buildEvidenceGraph } = require('../services/graphBuilder');
const dataStore = require('../services/dataStore');

async function submitComplaint(req, res) {
  const { complaintText } = req.body;
  const customerId = req.user.id; // always the logged-in user, never taken from the request body
  const totalStart = Date.now();

  try {
    const tAnalysisStart = Date.now();
    const analysis = await analyzeComplaint(complaintText);
    const complaintAnalysisMs = Date.now() - tAnalysisStart;

    const tInvStart = Date.now();
    const entityHints = [analysis.orderReference, ...(analysis.entities?.orderReferences || [])].filter(Boolean);
    const investigation = await investigate(customerId, complaintText, entityHints);
    const investigationMs = Date.now() - tInvStart;

    if (!investigation.found) {
      return res.status(404).json({ success: false, error: investigation.error });
    }

    const tRcStart = Date.now();
    const rootCause = await findRootCause(complaintText, analysis, investigation);
    const rootCauseMs = Date.now() - tRcStart;

    const tDecStart = Date.now();
    const decision = decide(complaintText, analysis, rootCause, investigation);
    const decisionMs = Date.now() - tDecStart;

    const tHandoffStart = Date.now();
    const [handoff, evidenceGraph] = await Promise.all([
      Promise.resolve(buildHandoff(investigation, rootCause, decision)),
      Promise.resolve(buildEvidenceGraph(investigation, rootCause, decision)),
    ]);
    const handoffMs = Date.now() - tHandoffStart;

    const ticketId = `TICKET-${randomUUID().slice(0, 8).toUpperCase()}`;
    await dataStore.saveTicket({
      id: ticketId, customerId, orderId: investigation.focusOrder?.id || null,
      category: analysis.intent || 'general', subject: complaintText.slice(0, 200),
      status: decision.action === 'auto_resolve' ? 'resolved' : decision.action === 'escalate' ? 'escalated' : 'open',
      resolution: decision.reason || null, analysis, investigation, rootCause, decision,
    });

    const totalMs = Date.now() - totalStart;
    console.log(`[Inquest Timing] Investigation: ${investigationMs}ms | Analysis: ${complaintAnalysisMs}ms | RootCause: ${rootCauseMs}ms | Decision: ${decisionMs}ms | Handoff: ${handoffMs}ms | Total: ${totalMs}ms`);

    res.status(200).json({ success: true, data: { ticketId, customerId, complaintText, analysis, investigation, rootCause, decision, handoff, evidenceGraph } });
  } catch (err) {
    console.error('[complaint.controller] submitComplaint failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to process complaint. Please try again.' });
  }
}

module.exports = { submitComplaint };
