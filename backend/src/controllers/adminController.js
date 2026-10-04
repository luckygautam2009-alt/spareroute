const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

const listPendingSellers = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT s.id, s.business_name, s.city, s.kyc_status, s.kyc_verified_at,
            s.kyc_name_on_id, s.is_approved, u.full_name, u.phone, u.email
     FROM sellers s JOIN users u ON u.id = s.user_id
     WHERE s.kyc_status = 'verified' AND s.is_approved = FALSE
     ORDER BY s.kyc_verified_at ASC`
  );
  res.json({ success: true, data: result.rows });
});

const approveSeller = asyncHandler(async (req, res) => {
  const { sellerId } = req.params;
  const { approve } = req.body;
  const sellerResult = await db.query('SELECT id, kyc_status FROM sellers WHERE id = $1', [sellerId]);
  const seller = sellerResult.rows[0];
  if (!seller) throw new AppError('Seller not found', 404);
  if (approve && seller.kyc_status !== 'verified') {
    throw new AppError('Cannot approve a seller whose KYC is not verified', 400);
  }
  const result = await db.query(
    `UPDATE sellers SET is_approved = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [approve, sellerId]
  );
  await db.query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, 'seller', $3, $4)`,
    [req.user.id, approve ? 'seller_approved' : 'seller_rejected', sellerId, JSON.stringify({})]
  );
  logger.info('Seller approval decision', { adminId: req.user.id, sellerId, approve });
  res.json({ success: true, data: result.rows[0] });
});

const createRefund = asyncHandler(async (req, res) => {
  const idempotencyKey = req.header('idempotency-key') || req.header('Idempotency-Key');
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 64) {
    throw new AppError('Idempotency-Key header is required (between 8 and 64 characters)', 400);
  }

  const { orderId, amountPaise, reason, returnRequestId } = req.body;

  // Check if idempotency key already exists before transaction
  const existingResult = await db.query(
    `SELECT * FROM refunds WHERE idempotency_key = $1`,
    [idempotencyKey]
  );
  if (existingResult.rows.length > 0) {
    const existing = existingResult.rows[0];
    const matchOrder = existing.order_id === orderId;
    const matchAmount = BigInt(existing.amount_paise) === BigInt(amountPaise);
    const matchReason = existing.reason === reason;
    const matchReturn = (existing.return_request_id || null) === (returnRequestId || null);
    if (matchOrder && matchAmount && matchReason && matchReturn) {
      return res.status(200).json({ success: true, data: existing });
    }
    throw new AppError('Idempotency key already used with different payload', 409);
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      `SELECT id, order_id, buyer_id, amount_paise, status FROM payments WHERE order_id = $1 FOR UPDATE`,
      [orderId]
    );
    const payment = paymentResult.rows[0];
    if (!payment) throw new AppError('Order or payment not found', 404);

    if (!['succeeded', 'partially_refunded'].includes(payment.status)) {
      throw new AppError('Payment must be succeeded or partially refunded before creating a refund', 409);
    }

    const refundedResult = await client.query(
      `SELECT COALESCE(SUM(amount_paise), 0) AS total_refunded FROM refunds WHERE payment_id = $1 AND status != 'failed'`,
      [payment.id]
    );
    const totalRefunded = BigInt(refundedResult.rows[0].total_refunded);
    const remainingRefundable = BigInt(payment.amount_paise) - totalRefunded;

    if (BigInt(amountPaise) <= 0n || BigInt(amountPaise) > remainingRefundable) {
      throw new AppError('Refund amount exceeds remaining refundable amount', 400);
    }

    if (returnRequestId) {
      const returnResult = await client.query(
        `SELECT id, order_id, status FROM return_requests WHERE id = $1`,
        [returnRequestId]
      );
      const ret = returnResult.rows[0];
      if (!ret || ret.order_id !== orderId) {
        throw new AppError('Return request does not belong to this order', 400);
      }
      if (ret.status !== 'received') {
        throw new AppError('Return request must be in received status to initiate refund', 400);
      }
    }

    const newRefundResult = await client.query(
      `INSERT INTO refunds (order_id, payment_id, return_request_id, amount_paise, status, reason, idempotency_key, created_by)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7) RETURNING *`,
      [orderId, payment.id, returnRequestId || null, amountPaise, reason, idempotencyKey, req.user.id]
    );
    const refund = newRefundResult.rows[0];

    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'refund_created', 'refund', $2, $3)`,
      [req.user.id, refund.id, JSON.stringify({ orderId, paymentId: payment.id, amountPaise, reason, idempotencyKey })]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: refund });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const replayResult = await db.query(
        `SELECT * FROM refunds WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (replayResult.rows.length > 0) {
        const existing = replayResult.rows[0];
        const matchOrder = existing.order_id === orderId;
        const matchAmount = BigInt(existing.amount_paise) === BigInt(amountPaise);
        const matchReason = existing.reason === reason;
        const matchReturn = (existing.return_request_id || null) === (returnRequestId || null);
        if (matchOrder && matchAmount && matchReason && matchReturn) {
          return res.status(200).json({ success: true, data: existing });
        }
        throw new AppError('Idempotency key already used with different payload', 409);
      }
    }
    throw err;
  } finally {
    client.release();
  }
});

const processRefund = asyncHandler(async (req, res) => {
  const refundId = req.params.id;
  const { status, note } = req.body;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const refundResult = await client.query(
      `SELECT * FROM refunds WHERE id = $1 FOR UPDATE`,
      [refundId]
    );
    const refund = refundResult.rows[0];
    if (!refund) throw new AppError('Refund not found', 404);

    if (refund.status !== 'pending') {
      throw new AppError(`Cannot process refund in '${refund.status}' status`, 409);
    }

    const paymentResult = await client.query(
      `SELECT id, amount_paise, status FROM payments WHERE id = $1 FOR UPDATE`,
      [refund.payment_id]
    );
    const payment = paymentResult.rows[0];
    if (!payment) throw new AppError('Associated payment not found', 404);

    const updatedRefundResult = await client.query(
      `UPDATE refunds
       SET status = $1, processed_by = $2, processed_note = $3, processed_at = now()
       WHERE id = $4 RETURNING *`,
      [status, req.user.id, note || null, refundId]
    );
    const updatedRefund = updatedRefundResult.rows[0];

    if (status === 'processed') {
      const totalProcessedResult = await client.query(
        `SELECT COALESCE(SUM(amount_paise), 0) AS total_processed
         FROM refunds WHERE payment_id = $1 AND status = 'processed'`,
        [refund.payment_id]
      );
      const totalProcessed = BigInt(totalProcessedResult.rows[0].total_processed);
      const newPaymentStatus = totalProcessed >= BigInt(payment.amount_paise) ? 'refunded' : 'partially_refunded';

      await client.query(
        `UPDATE payments SET status = $1, updated_at = now() WHERE id = $2`,
        [newPaymentStatus, payment.id]
      );

      if (refund.return_request_id) {
        await client.query(
          `UPDATE return_requests SET status = 'refunded', updated_at = now() WHERE id = $1`,
          [refund.return_request_id]
        );
      }
    }

    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'refund', $3, $4)`,
      [req.user.id, status === 'processed' ? 'refund_processed' : 'refund_failed', refundId,
       JSON.stringify({ status, note: note || null, paymentId: refund.payment_id, orderId: refund.order_id })]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: updatedRefund });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const listRefunds = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (req.query.status) {
    params.push(req.query.status);
    conditions.push(`status = $${params.length}`);
  }
  if (req.query.orderId) {
    params.push(req.query.orderId);
    conditions.push(`order_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await db.query(`SELECT COUNT(*) AS total FROM refunds ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].total, 10);

  const queryParams = [...params, limit, offset];
  const dataResult = await db.query(
    `SELECT * FROM refunds ${whereClause} ORDER BY created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
    queryParams
  );

  res.json({
    success: true,
    data: dataResult.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

module.exports = { listPendingSellers, approveSeller, createRefund, processRefund, listRefunds };
