const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { generateOtp, encryptOtp } = require('../utils/deliveryOtp');

const listAvailable = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT o.id, o.order_number, o.delivery_address, o.delivery_latitude, o.delivery_longitude,
            o.total_amount_paise, o.created_at, s.business_name, s.city
     FROM orders o JOIN sellers s ON s.id = o.seller_id
     WHERE o.status = 'accepted_by_seller' AND o.delivery_partner_id IS NULL
     ORDER BY o.created_at ASC LIMIT 50`
  );
  res.json({ success: true, data: result.rows });
});

const claimOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, status, delivery_partner_id FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    const order = result.rows[0];
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== 'accepted_by_seller') {
      throw new AppError('This order is not available for delivery yet', 409);
    }
    if (order.delivery_partner_id) {
      throw new AppError('This order has already been claimed by another delivery partner', 409);
    }
    const updated = await client.query(
      `UPDATE orders SET delivery_partner_id = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [req.user.id, orderId]
    );
    await client.query('COMMIT');
    logger.info('Order claimed by delivery partner', { orderId, deliveryPartnerId: req.user.id });
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const updateStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT status FROM orders WHERE id = $1 AND delivery_partner_id = $2 FOR UPDATE`,
      [orderId, req.user.id]
    );
    const current = currentResult.rows[0];
    if (!current) throw new AppError('Order not found or not assigned to you', 404);

    const validTransitions = {
      accepted_by_seller: ['out_for_delivery'],
      out_for_delivery: ['delivered'],
    };
    const allowedNext = validTransitions[current.status] || [];
    if (!allowedNext.includes(status)) {
      throw new AppError(`Cannot move order from '${current.status}' to '${status}'`, 400);
    }

    let result;
    if (status === 'delivered') {
      result = await client.query(
        `UPDATE orders SET status = $1, delivered_at = now(), updated_at = now() WHERE id = $2 AND delivery_partner_id = $3 RETURNING *`,
        [status, orderId, req.user.id]
      );
      await client.query(
        `UPDATE payments SET status = 'succeeded', collected_at = now(), updated_at = now() WHERE order_id = $1`,
        [orderId]
      );
    } else if (status === 'out_for_delivery') {
      result = await client.query(
        `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 AND delivery_partner_id = $3 RETURNING *`,
        [status, orderId, req.user.id]
      );
      const rawOtp = generateOtp();
      const ciphertext = encryptOtp(rawOtp);
      await client.query(
        `INSERT INTO order_delivery_otps (order_id, otp_ciphertext, generated_at, failed_attempts, regenerated_count)
         VALUES ($1, $2, now(), 0, 0)
         ON CONFLICT (order_id) DO UPDATE
         SET otp_ciphertext = EXCLUDED.otp_ciphertext,
             generated_at = now(),
             failed_attempts = 0,
             locked_at = NULL`,
        [orderId, ciphertext]
      );
    } else {
      result = await client.query(
        `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 AND delivery_partner_id = $3 RETURNING *`,
        [status, orderId, req.user.id]
      );
    }

    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_at)
       VALUES ($1, $2, $3, $4, now())`,
      [orderId, current.status, status, req.user.id]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const myDeliveries = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT * FROM orders WHERE delivery_partner_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ success: true, data: result.rows });
});

module.exports = { listAvailable, claimOrder, updateStatus, myDeliveries };
