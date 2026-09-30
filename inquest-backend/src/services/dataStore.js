const db = require('../db/connection');

const SPAREROUTE_API_URL = process.env.SPAREROUTE_API_URL;
const SPAREROUTE_INTERNAL_API_KEY = process.env.SPAREROUTE_INTERNAL_API_KEY;

async function getSpareRouteContext(customerId) {
  if (!SPAREROUTE_API_URL || !SPAREROUTE_INTERNAL_API_KEY) {
    throw new Error('SPAREROUTE_API_URL / SPAREROUTE_INTERNAL_API_KEY not configured');
  }

  const res = await fetch(`${SPAREROUTE_API_URL}/api/internal/customers/${customerId}/context`, {
    headers: { 'x-internal-api-key': SPAREROUTE_INTERNAL_API_KEY },
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`SpareRoute internal API error: ${res.status}`);

  const body = await res.json();
  return body.data;
}

const getTicketsByCustomerId = async (customerId) => {
  const result = await db.query('SELECT * FROM tickets WHERE customer_id = $1 ORDER BY date DESC', [customerId]);
  return result.rows;
};

const getRefundsByCustomerId = async (customerId) => {
  const result = await db.query('SELECT * FROM refunds WHERE customer_id = $1', [customerId]);
  return result.rows;
};

const getSecurityEventsByCustomerId = async (customerId) => {
  const result = await db.query('SELECT * FROM security_events WHERE customer_id = $1', [customerId]);
  return result.rows;
};

const getAllPolicies = async () => {
  const result = await db.query('SELECT * FROM policies');
  return result.rows;
};

async function saveTicket({ id, customerId, orderId, category, subject, status, resolution, analysis, investigation, rootCause, decision }) {
  const result = await db.query(
    `INSERT INTO tickets (id, customer_id, order_id, category, subject, status, resolution, analysis, investigation, root_cause, decision)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [id, customerId, orderId || null, category || null, subject, status, resolution || null,
     JSON.stringify(analysis || {}), JSON.stringify(investigation || {}), JSON.stringify(rootCause || {}), JSON.stringify(decision || {})]
  );
  return result.rows[0];
}

module.exports = { getSpareRouteContext, getTicketsByCustomerId, getRefundsByCustomerId, getSecurityEventsByCustomerId, getAllPolicies, saveTicket };
