const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { generateOtp, encryptOtp, decryptOtp } = require('../utils/deliveryOtp');

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
  const { status, otp } = req.body;

  const orderCheck = await db.query(
    `SELECT id, status, delivery_partner_id FROM orders WHERE id = $1`,
    [orderId]
  );
  const current = orderCheck.rows[0];
  if (!current || current.delivery_partner_id !== req.user.id) {
    throw new AppError('Order not found or not assigned to you', 404);
  }

  if (status === 'delivered') {
    if (current.status === 'delivered') {
      throw new AppError('Order has already been delivered', 409);
    }
    if (current.status !== 'out_for_delivery') {
      throw new AppError(`Cannot move order from '${current.status}' to 'delivered'`, 409);
    }

    const otpResult = await db.query(
      `SELECT order_id, otp_ciphertext, failed_attempts, locked_at FROM order_delivery_otps WHERE order_id = $1`,
      [orderId]
    );
    const otpRow = otpResult.rows[0];
    if (!otpRow) {
      throw new AppError('Delivery code not found for this order', 409);
    }
    if (otpRow.locked_at !== null || otpRow.failed_attempts >= 5) {
      throw new AppError('Delivery code locked. Contact support.', 423);
    }

    if (!otpRow.otp_ciphertext) {
      throw new AppError('Delivery code already used or expired', 409);
    }

    const actualOtp = decryptOtp(otpRow.otp_ciphertext);
    let isMatch = false;
    if (actualOtp && otp && actualOtp.length === otp.length) {
      isMatch = crypto.timingSafeEqual(Buffer.from(actualOtp, 'utf8'), Buffer.from(otp, 'utf8'));
    }

    if (!isMatch) {
      // Must be committed separately even though request fails
      await db.query(
        `UPDATE order_delivery_otps
         SET failed_attempts = LEAST(failed_attempts + 1, 5),
             locked_at = CASE WHEN failed_attempts + 1 >= 5 THEN COALESCE(locked_at, now()) ELSE locked_at END
         WHERE order_id = $1`,
        [orderId]
      );
      throw new AppError('Invalid delivery code', 400);
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE orders
         SET status = 'delivered', delivered_at = now(), delivered_via = 'otp', updated_at = now()
         WHERE id = $1 AND delivery_partner_id = $2
         RETURNING *`,
        [orderId, req.user.id]
      );
      await client.query(
        `UPDATE order_delivery_otps
         SET verified_at = now(), otp_ciphertext = NULL
         WHERE order_id = $1`,
        [orderId]
      );
      await client.query(
        `UPDATE payments SET status = 'succeeded', collected_at = now(), updated_at = now() WHERE order_id = $1`,
        [orderId]
      );
      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_at)
         VALUES ($1, $2, 'delivered', $3, now())`,
        [orderId, current.status, req.user.id]
      );
      await client.query('COMMIT');
      return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Non-delivered transitions (e.g. out_for_delivery)
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const currentLock = await client.query(
      `SELECT status FROM orders WHERE id = $1 AND delivery_partner_id = $2 FOR UPDATE`,
      [orderId, req.user.id]
    );
    const lockedCurrent = currentLock.rows[0];
    if (!lockedCurrent) throw new AppError('Order not found or not assigned to you', 404);

    const validTransitions = {
      accepted_by_seller: ['out_for_delivery'],
      out_for_delivery: ['delivered'],
    };
    const allowedNext = validTransitions[lockedCurrent.status] || [];
    if (!allowedNext.includes(status)) {
      throw new AppError(`Cannot move order from '${lockedCurrent.status}' to '${status}'`, 400);
    }

    let result;
    if (status === 'out_for_delivery') {
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
      [orderId, lockedCurrent.status, status, req.user.id]
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
