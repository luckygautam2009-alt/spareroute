const dataStore = require('./dataStore');

function convertDevanagariDigits(str) {
  if (!str) return str;
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(devanagariDigits[i], 'g'), String(i));
  }
  return res;
}

function extractOrderIdHint(complaintText, entityHints = []) {
  if (Array.isArray(entityHints) && entityHints.length > 0) {
    for (const hint of entityHints) {
      if (hint && String(hint).trim()) {
        const clean = convertDevanagariDigits(String(hint).trim().toUpperCase().replace(/^ORDER\s*#?/i, ''));
        if (clean) return clean;
      }
    }
  }
  if (!complaintText) return null;
  const normalized = convertDevanagariDigits(String(complaintText))
    .replace(/[ऑओ]र्ड[रर्]/g, 'order')
    .replace(/\border\b/gi, 'order');
  const patterns = [
    /order\s*(?:id|no\.?|number|#)?\s*:?\s*([A-Za-z]*\d+[A-Za-z0-9]*)/i,
    /(?:mera|meri)\s*([A-Za-z]*\d+[A-Za-z0-9]*)\s*wala\s*order/i,
    /#\s*([A-Za-z]*\d+[A-Za-z0-9]*)/i,
    /\b(ORDER\d+)\b/i,
    /\b(\d{3,})\b/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1].toUpperCase().replace(/^ORDER/i, '');
  }
  return null;
}

async function investigate(customerId, complaintText, entityHints = []) {
  const context = await dataStore.getSpareRouteContext(customerId);
  if (!context) {
    return { found: false, error: `Customer with ID ${customerId} not found` };
  }
  const { customer, orders, payments } = context;

  const [tickets, refunds, securityEvents, policies] = await Promise.all([
    dataStore.getTicketsByCustomerId(customerId),
    dataStore.getRefundsByCustomerId(customerId),
    dataStore.getSecurityEventsByCustomerId(customerId),
    dataStore.getAllPolicies(),
  ]);

  const orderHint = extractOrderIdHint(complaintText, entityHints);
  let focusOrder = null, focusPayments = [], focusRefunds = [], orderMismatch = false;

  if (orderHint) {
    focusOrder = orders.find((o) => {
      const ordId = String(o.id).toUpperCase();
      const hint = orderHint.toUpperCase();
      return ordId === hint || ordId === `ORDER${hint}` || ordId.includes(hint);
    }) || null;

    if (focusOrder) {
      if (focusOrder.customerId !== customerId) {
        focusOrder = null; focusPayments = []; focusRefunds = []; orderMismatch = true;
      } else {
        focusPayments = payments.filter((p) => p.orderId === focusOrder.id && p.customerId === customerId);
        focusRefunds = refunds.filter((r) => r.order_id === focusOrder.id && r.customer_id === customerId);
      }
    } else {
      orderMismatch = true;
    }
  } else {
    if (orders.length === 1) {
      focusOrder = orders[0];
      focusPayments = payments.filter((p) => p.orderId === focusOrder.id);
      focusRefunds = refunds.filter((r) => r.order_id === focusOrder.id);
    } else if (orders.length > 1) {
      const relevantOrder = orders.find((o) => o.status === 'returned' || o.status === 'cancelled' || o.status === 'out_for_delivery' || o.returnRequested);
      if (relevantOrder) {
        focusOrder = relevantOrder;
        focusPayments = payments.filter((p) => p.orderId === focusOrder.id);
        focusRefunds = refunds.filter((r) => r.order_id === focusOrder.id);
      }
    }
  }

  return { found: true, customer, orders, payments, tickets, refunds, securityEvents, policies, focusOrder, focusPayments, focusRefunds, orderHintDetected: orderHint, orderVerified: Boolean(focusOrder), orderMismatch };
}

module.exports = { investigate, extractOrderIdHint, convertDevanagariDigits };
