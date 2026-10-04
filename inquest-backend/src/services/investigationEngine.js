const dataStore = require('./dataStore');
const { adaptContext } = require('./spareRouteAdapter');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_RE = /^SR[-\s]?(\d{1,8})$/i;

function convertDevanagariDigits(str) {
  if (!str) return str;
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(devanagariDigits[i], 'g'), String(i));
  }
  return res;
}

/**
 * Normalise an order hint to either:
 *   - A full UUID string (lowercase), or
 *   - An order number in the form "SR-XXXXXXXX" (zero-padded to 8 digits)
 * Returns null if the hint cannot be normalised to either form.
 */
function normaliseOrderHint(raw) {
  if (!raw) return null;
  const clean = convertDevanagariDigits(String(raw).trim());
  if (!clean) return null;

  // Try UUID
  if (UUID_RE.test(clean)) return clean.toLowerCase();

  // Try SR-XXXXXXXX pattern (flexible spacing/dash)
  const srMatch = clean.match(ORDER_NUMBER_RE);
  if (srMatch) {
    const digits = srMatch[1].padStart(8, '0');
    return `SR-${digits}`;
  }

  return null; // Not normalisable — treat as "no hint"
}

function extractOrderIdHint(complaintText, entityHints = []) {
  // 1. Check entity hints from LLM analysis first
  if (Array.isArray(entityHints) && entityHints.length > 0) {
    for (const hint of entityHints) {
      if (hint && String(hint).trim()) {
        const cleanRaw = convertDevanagariDigits(String(hint).trim().toUpperCase().replace(/^ORDER\s*#?/i, ''));
        const normalised = normaliseOrderHint(cleanRaw);
        if (normalised) return normalised;
      }
    }
  }

  // 2. Extract from complaint text using patterns
  if (!complaintText) return null;
  const normalized = convertDevanagariDigits(String(complaintText))
    .replace(/[ऑओ]र्ड[रर्]/g, 'order')
    .replace(/\border\b/gi, 'order');

  const patterns = [
    /order\s*(?:id|no\.?|number|#)?\s*:?\s*\b(SR[-\s]?\d{1,8})\b/i,
    /order\s*(?:id|no\.?|number|#)?\s*:?\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    /(?:mera|meri)\s*\b(SR[-\s]?\d{1,8})\b\s*wala\s*order/i,
    /#\s*\b(SR[-\s]?\d{1,8})\b/i,
    /\b(SR[-\s]?\d{1,8})\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const normalised = normaliseOrderHint(match[1]);
      if (normalised) return normalised;
    }
  }

  return null;
}

async function investigate(customerId, complaintText, entityHints = []) {
  const rawContext = await dataStore.getSpareRouteContext(customerId);
  if (!rawContext) {
    return { found: false, error: `Customer with ID ${customerId} not found` };
  }

  // Adapt SpareRoute context through the adapter
  const context = adaptContext(rawContext);
  const { customer, orders, payments, refunds: spareRouteRefunds } = context;

  const [tickets, securityEvents, policies] = await Promise.all([
    dataStore.getTicketsByCustomerId(customerId),
    dataStore.getSecurityEventsByCustomerId(customerId),
    dataStore.getAllPolicies(),
  ]);

  // Use SpareRoute refunds (camelCase) instead of local Inquest refunds table
  const refunds = spareRouteRefunds;

  const orderHint = extractOrderIdHint(complaintText, entityHints);
  let focusOrder = null;
  let focusPayments = [];
  let focusRefunds = [];
  let orderMismatch = false;
  let orderInferred = false;

  if (orderHint) {
    // Exact matching only: UUID equality or orderNumber equality
    focusOrder = orders.find((o) => {
      if (UUID_RE.test(orderHint)) {
        return o.id.toLowerCase() === orderHint;
      }
      // orderNumber comparison
      return o.orderNumber === orderHint;
    }) || null;

    if (focusOrder) {
      if (focusOrder.customerId !== customerId) {
        // GUARD 1: ownership mismatch
        focusOrder = null;
        focusPayments = [];
        focusRefunds = [];
        orderMismatch = true;
      } else {
        focusPayments = payments.filter((p) => p.orderId === focusOrder.id && p.customerId === customerId);
        focusRefunds = refunds.filter((r) => r.orderId === focusOrder.id && r.customerId === customerId);
      }
    } else {
      // Normalised hint matched none of THIS customer's orders
      orderMismatch = true;
    }
  } else {
    // No hint provided
    if (orders.length === 1) {
      // Single-order inference
      focusOrder = orders[0];
      focusPayments = payments.filter((p) => p.orderId === focusOrder.id);
      focusRefunds = refunds.filter((r) => r.orderId === focusOrder.id);
      orderInferred = true;
    } else if (orders.length > 1) {
      // Relevant order fallback (also inferred)
      const relevantOrder = orders.find(
        (o) => o.status === 'returned' || o.status === 'cancelled' || o.status === 'out_for_delivery' || o.returnRequested
      );
      if (relevantOrder) {
        focusOrder = relevantOrder;
        focusPayments = payments.filter((p) => p.orderId === focusOrder.id);
        focusRefunds = refunds.filter((r) => r.orderId === focusOrder.id);
        orderInferred = true;
      }
    }
  }

  return {
    found: true,
    customer,
    orders,
    payments,
    tickets,
    refunds,
    securityEvents,
    policies,
    focusOrder,
    focusPayments,
    focusRefunds,
    orderHintDetected: orderHint,
    orderVerified: Boolean(focusOrder),
    orderMismatch,
    orderInferred,
  };
}

module.exports = { investigate, extractOrderIdHint, normaliseOrderHint, convertDevanagariDigits };
