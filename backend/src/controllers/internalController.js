const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getCustomerContext = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!UUID_RE.test(userId)) {
    throw new AppError('Invalid user id', 400);
  }

  const customerResult = await db.query(
    `SELECT id, full_name AS name, phone, email, created_at AS "joinedOn"
     FROM users WHERE id = $1 AND role = 'buyer' AND is_active = TRUE`,
    [userId]
  );
  const customer = customerResult.rows[0];
  if (!customer) {
    throw new AppError(`Customer with ID ${userId} not found`, 404);
  }

  const deliverySlaHours = parseInt(process.env.DELIVERY_SLA_HOURS, 10) || 48;

  const ordersResult = await db.query(
    `SELECT o.id, o.status, o.total_amount_paise AS amount, o.service_fee_paise,
            o.delivery_address, o.mechanic_id, o.mechanic_rating,
            o.delivered_at, o.cancelled_by, o.cancel_reason,
            o.created_at AS "placedAt", o.updated_at AS "updatedAt",
            oi.product_id, p.name AS "productName", s.business_name AS "sellerName"
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN sellers s ON s.id = o.seller_id
     WHERE o.buyer_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );

  const historyResult = await db.query(
    `SELECT h.order_id, h.from_status, h.to_status, h.changed_at
     FROM order_status_history h
     JOIN orders o ON o.id = h.order_id
     WHERE o.buyer_id = $1
     ORDER BY h.changed_at ASC`,
    [userId]
  );

  const returnsResult = await db.query(
    `SELECT r.id, r.order_id, r.buyer_id, r.reason, r.status, r.seller_note,
            r.created_at, r.updated_at
     FROM return_requests r
     WHERE r.buyer_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  );

  const paymentsResult = await db.query(
    `SELECT p.id, p.order_id, p.buyer_id, p.amount_paise, p.method, p.status,
            p.collected_at, p.created_at, p.updated_at
     FROM payments p
     WHERE p.buyer_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );

  const refundsResult = await db.query(
    `SELECT r.id, r.order_id, r.payment_id, r.return_request_id, r.amount_paise,
            r.status, r.reason, r.created_at, r.processed_at,
            p.buyer_id AS customer_id
     FROM refunds r
     JOIN payments p ON p.id = r.payment_id
     WHERE p.buyer_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  );

  const orders = ordersResult.rows.map((o) => {
    const orderReturns = returnsResult.rows.filter((r) => r.order_id === o.id);
    const activeReturn = orderReturns.find((r) => ['requested', 'approved', 'received'].includes(r.status));
    const latestReturn = orderReturns[0] || null;

    const historyForOrder = historyResult.rows
      .filter((h) => h.order_id === o.id)
      .map((h) => ({ from: h.from_status, to: h.to_status, at: h.changed_at }));

    const placedDate = new Date(o.placedAt);
    const expectedDeliveryBy = new Date(placedDate.getTime() + deliverySlaHours * 60 * 60 * 1000).toISOString();

    return {
      id: o.id,
      customerId: userId,
      product: o.productName || 'Unknown product',
      amount: Number(o.amount) / 100,
      status: o.status,
      deliveredAt: o.delivered_at || null,
      returnRequested: Boolean(activeReturn),
      returnStatus: activeReturn ? activeReturn.status : (latestReturn ? latestReturn.status : null),
      expectedDeliveryBy,
      statusHistory: historyForOrder,
      cancelReason: o.cancel_reason || null,
    };
  });

  const payments = paymentsResult.rows.map((p) => ({
    id: p.id,
    orderId: p.order_id,
    customerId: p.buyer_id,
    amount: Number(p.amount_paise) / 100,
    status: ['succeeded', 'partially_refunded', 'refunded'].includes(p.status)
      ? 'success'
      : p.status === 'cancelled'
      ? 'failed'
      : 'pending',
    timestamp: p.created_at,
    rawStatus: p.status,
    method: p.method,
    collectedAt: p.collected_at || null,
  }));

  const refunds = refundsResult.rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    customerId: r.customer_id,
    amount: Number(r.amount_paise) / 100,
    status: r.status,
    reason: r.reason,
    initiatedAt: r.created_at,
    completedAt: r.processed_at || null,
  }));

  const returnRequests = returnsResult.rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    customerId: r.buyer_id,
    reason: r.reason,
    status: r.status,
    sellerNote: r.seller_note || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  res.json({
    success: true,
    data: {
      customer,
      orders,
      payments,
      refunds,
      returnRequests,
    },
  });
});

const getAuthStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!UUID_RE.test(userId)) {
    throw new AppError('Invalid user id', 400);
  }
  const result = await db.query(
    'SELECT id, role, is_active FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    throw new AppError('User not found', 404);
  }
  res.json({ success: true, data: { id: user.id, role: user.role, isActive: user.is_active } });
});

module.exports = { getCustomerContext, getAuthStatus };
