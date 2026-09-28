const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const getCustomerContext = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const customerResult = await db.query(
    `SELECT id, full_name AS name, phone, email, created_at AS "joinedOn"
     FROM users WHERE id = $1 AND role = 'buyer'`,
    [userId]
  );
  const customer = customerResult.rows[0];
  if (!customer) {
    throw new AppError(`Customer with ID ${userId} not found`, 404);
  }

  const ordersResult = await db.query(
    `SELECT o.id, o.status, o.total_amount_paise AS amount, o.service_fee_paise,
            o.delivery_address, o.mechanic_id, o.mechanic_rating,
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

  const payments = ordersResult.rows.map((o) => ({
    id: `PAY-${o.id}`,
    orderId: o.id,
    customerId: userId,
    amount: Number(o.amount) / 100,
    status: ['delivered', 'accepted_by_seller', 'out_for_delivery'].includes(o.status)
      ? 'success'
      : o.status === 'cancelled' || o.status === 'rejected_by_seller'
      ? 'failed'
      : 'pending',
    timestamp: o.placedAt,
  }));

  const orders = ordersResult.rows.map((o) => ({
    id: o.id,
    customerId: userId,
    product: o.productName || 'Unknown product',
    amount: Number(o.amount) / 100,
    status: o.status,
    deliveredAt: o.status === 'delivered' ? o.updatedAt : null,
    returnRequested: false,
  }));

  res.json({
    success: true,
    data: { customer, orders, payments, refunds: [], securityEvents: [] },
  });
});

module.exports = { getCustomerContext };
