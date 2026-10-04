const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const reviewReturn = asyncHandler(async (req, res) => {
  const returnId = req.params.id || req.params.returnId;
  const { decision, note } = req.body;

  const sellerResult = await db.query('SELECT id FROM sellers WHERE user_id = $1', [req.user.id]);
  const seller = sellerResult.rows[0];
  if (!seller) throw new AppError('Seller profile not found', 404);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Find the order_id for this return request first
    const retLookup = await client.query(
      `SELECT order_id FROM return_requests WHERE id = $1`,
      [returnId]
    );
    if (retLookup.rows.length === 0) {
      throw new AppError('Return request not found', 404);
    }
    const orderId = retLookup.rows[0].order_id;

    // Lock ORDER row FIRST
    const orderResult = await client.query(
      `SELECT id, seller_id, status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order || order.seller_id !== seller.id) {
      throw new AppError('Return request not found', 404);
    }

    // Lock RETURN row SECOND
    const returnResult = await client.query(
      `SELECT id, order_id, buyer_id, status FROM return_requests WHERE id = $1 FOR UPDATE`,
      [returnId]
    );
    const ret = returnResult.rows[0];
    if (!ret) {
      throw new AppError('Return request not found', 404);
    }
    if (ret.status !== 'requested') {
      throw new AppError(`Cannot review return request in '${ret.status}' status`, 409);
    }

    const updated = await client.query(
      `UPDATE return_requests
       SET status = $1, seller_note = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [decision, note || null, returnId]
    );

    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'return_request', $3, $4)`,
      [req.user.id, `return_${decision}`, returnId, JSON.stringify({ decision, note: note || null, orderId })]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const markReceived = asyncHandler(async (req, res) => {
  const returnId = req.params.id || req.params.returnId;

  const sellerResult = await db.query('SELECT id FROM sellers WHERE user_id = $1', [req.user.id]);
  const seller = sellerResult.rows[0];
  if (!seller) throw new AppError('Seller profile not found', 404);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Find the order_id for this return request first
    const retLookup = await client.query(
      `SELECT order_id FROM return_requests WHERE id = $1`,
      [returnId]
    );
    if (retLookup.rows.length === 0) {
      throw new AppError('Return request not found', 404);
    }
    const orderId = retLookup.rows[0].order_id;

    // Lock ORDER row FIRST
    const orderResult = await client.query(
      `SELECT id, seller_id, status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order || order.seller_id !== seller.id) {
      throw new AppError('Return request not found', 404);
    }

    // Lock RETURN row SECOND
    const returnResult = await client.query(
      `SELECT id, order_id, buyer_id, status FROM return_requests WHERE id = $1 FOR UPDATE`,
      [returnId]
    );
    const ret = returnResult.rows[0];
    if (!ret) {
      throw new AppError('Return request not found', 404);
    }
    if (ret.status !== 'approved') {
      throw new AppError(`Cannot mark return as received from '${ret.status}' status`, 409);
    }

    const updated = await client.query(
      `UPDATE return_requests
       SET status = 'received', updated_at = now()
       WHERE id = $1 RETURNING *`,
      [returnId]
    );

    await client.query(
      `UPDATE orders SET status = 'returned', updated_at = now() WHERE id = $1`,
      [orderId]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_at)
       VALUES ($1, $2, 'returned', $3, now())`,
      [orderId, order.status, req.user.id]
    );

    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'return_received', 'return_request', $2, $3)`,
      [req.user.id, returnId, JSON.stringify({ orderId })]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const listReturns = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params = [];

  if (req.user.role === 'buyer') {
    params.push(req.user.id);
    whereClause = `WHERE r.buyer_id = $${params.length}`;
  } else if (req.user.role === 'seller') {
    const sellerResult = await db.query('SELECT id FROM sellers WHERE user_id = $1', [req.user.id]);
    const seller = sellerResult.rows[0];
    if (!seller) throw new AppError('Seller profile not found', 404);
    params.push(seller.id);
    whereClause = `WHERE o.seller_id = $${params.length}`;
  } else if (req.user.role === 'admin') {
    whereClause = '';
  } else {
    throw new AppError('Forbidden', 403);
  }

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM return_requests r
    JOIN orders o ON o.id = r.order_id
    ${whereClause}
  `;
  const countResult = await db.query(countQuery, params);
  const total = parseInt(countResult.rows[0].total, 10);

  const queryParams = [...params, limit, offset];
  const dataQuery = `
    SELECT r.id, r.order_id, r.buyer_id, r.reason, r.status, r.seller_note,
           r.created_at, r.updated_at, o.seller_id
    FROM return_requests r
    JOIN orders o ON o.id = r.order_id
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
  `;
  const dataResult = await db.query(dataQuery, queryParams);

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

module.exports = { reviewReturn, markReceived, listReturns };
