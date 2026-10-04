const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { decryptOtp, generateOtp, encryptOtp } = require('../utils/deliveryOtp');

const create = asyncHandler(async (req, res) => {
  const { productId, quantity, deliveryAddress, deliveryLatitude, deliveryLongitude, mechanicId } = req.body;
  const paymentMethod = req.body.paymentMethod || req.body.payment_method || 'cod';
  if (paymentMethod === 'online') {
    throw new AppError('Online payments are not available yet', 501);
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      `SELECT id, seller_id, price_paise, stock_quantity, is_active
       FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );
    const product = productResult.rows[0];

    if (!product || !product.is_active) throw new AppError('Product not found', 404);
    if (product.stock_quantity < quantity) {
      throw new AppError(`Only ${product.stock_quantity} unit(s) left in stock`, 409);
    }

    let serviceFeePaise = 0n;
    if (mechanicId) {
      const mechanicResult = await client.query(
        `SELECT id, seller_id, service_fee_paise FROM mechanics
         WHERE id = $1 AND is_active = TRUE FOR UPDATE`,
        [mechanicId]
      );
      const mechanic = mechanicResult.rows[0];
      if (!mechanic) throw new AppError('Mechanic not found or not active', 404);
      if (mechanic.seller_id !== product.seller_id) {
        throw new AppError('This mechanic does not belong to the seller of this product', 400);
      }
      serviceFeePaise = BigInt(mechanic.service_fee_paise);
    }

    await client.query(
      `UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = now() WHERE id = $2`,
      [quantity, productId]
    );

    const totalAmountPaise = BigInt(product.price_paise) * BigInt(quantity);

    const orderResult = await client.query(
      `INSERT INTO orders
         (buyer_id, seller_id, total_amount_paise, delivery_address, delivery_latitude, delivery_longitude,
          mechanic_id, service_fee_paise)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, product.seller_id, totalAmountPaise.toString(), deliveryAddress,
       deliveryLatitude || null, deliveryLongitude || null, mechanicId || null, serviceFeePaise.toString()]
    );
    const order = orderResult.rows[0];

    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price_paise)
       VALUES ($1, $2, $3, $4)`,
      [order.id, product.id, quantity, product.price_paise]
    );

    const paymentAmountPaise = totalAmountPaise + serviceFeePaise;
    await client.query(
      `INSERT INTO payments (order_id, buyer_id, amount_paise, method, status)
       VALUES ($1, $2, $3, 'cod', 'pending')`,
      [order.id, req.user.id, paymentAmountPaise.toString()]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_at)
       VALUES ($1, NULL, 'placed', $2, now())`,
      [order.id, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: order });
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
    const sellerResult = await client.query('SELECT id FROM sellers WHERE user_id = $1', [req.user.id]);
    const seller = sellerResult.rows[0];
    if (!seller) throw new AppError('Seller profile not found', 404);

    const orderResult = await client.query(
      `SELECT id, status, delivery_partner_id FROM orders WHERE id = $1 AND seller_id = $2 FOR UPDATE`,
      [orderId, seller.id]
    );
    const order = orderResult.rows[0];
    if (!order) throw new AppError('Order not found or does not belong to you', 404);

    const fromStatus = order.status;
    const isValidTransition =
      (fromStatus === 'placed' && (status === 'accepted_by_seller' || status === 'rejected_by_seller')) ||
      (fromStatus === 'accepted_by_seller' && status === 'cancelled' && order.delivery_partner_id === null);

    if (!isValidTransition) {
      throw new AppError(`Cannot transition order from '${fromStatus}' to '${status}'`, 409);
    }

    let result;
    if (status === 'rejected_by_seller' || status === 'cancelled') {
      const itemsResult = await client.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
        [orderId]
      );
      for (const item of itemsResult.rows) {
        await client.query(
          `SELECT id FROM products WHERE id = $1 FOR UPDATE`,
          [item.product_id]
        );
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = now() WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      result = await client.query(
        `UPDATE orders SET status = $1, cancelled_by = $2, updated_at = now() WHERE id = $3 AND seller_id = $4 RETURNING *`,
        [status, req.user.id, orderId, seller.id]
      );
      await client.query(
        `UPDATE payments SET status = 'cancelled', updated_at = now() WHERE order_id = $1 AND status = 'pending'`,
        [orderId]
      );
    } else {
      result = await client.query(
        `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 AND seller_id = $3 RETURNING *`,
        [status, orderId, seller.id]
      );
    }

    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_at)
       VALUES ($1, $2, $3, $4, now())`,
      [orderId, fromStatus, status, req.user.id]
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

const myOrders = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ success: true, data: result.rows });
});

const rateMechanic = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { rating, comment } = req.body;
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `SELECT id, buyer_id, status, mechanic_id, mechanic_rating FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order || order.buyer_id !== req.user.id) throw new AppError('Order not found', 404);
    if (!order.mechanic_id) throw new AppError('This order did not include a mechanic', 400);
    if (order.status !== 'delivered') {
      throw new AppError('You can only rate a mechanic after the order is delivered', 400);
    }
    if (order.mechanic_rating !== null) {
      throw new AppError('You have already rated this mechanic for this order', 409);
    }

    await client.query(
      `UPDATE orders SET mechanic_rating = $1, mechanic_rating_comment = $2, updated_at = now() WHERE id = $3`,
      [rating, comment || null, orderId]
    );

    const statsResult = await client.query(
      `SELECT AVG(mechanic_rating)::numeric(3,2) AS avg_rating, COUNT(*) AS total_ratings
       FROM orders WHERE mechanic_id = $1 AND mechanic_rating IS NOT NULL`,
      [order.mechanic_id]
    );
    const { avg_rating, total_ratings } = statsResult.rows[0];

    await client.query(
      `UPDATE mechanics SET avg_rating = $1, total_ratings = $2, updated_at = now() WHERE id = $3`,
      [avg_rating, total_ratings, order.mechanic_id]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: { rating, comment: comment || null } });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const cancelOrder = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId || req.params.id;
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `SELECT id, buyer_id, status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order || order.buyer_id !== req.user.id) {
      throw new AppError('Order not found', 404);
    }
    if (!['placed', 'accepted_by_seller'].includes(order.status)) {
      throw new AppError(`Cannot cancel order in '${order.status}' status`, 409);
    }

    const itemsResult = await client.query(
      `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    for (const item of itemsResult.rows) {
      await client.query(
        `SELECT id FROM products WHERE id = $1 FOR UPDATE`,
        [item.product_id]
      );
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = now() WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    const cancelReason = req.body?.reason || req.body?.cancelReason || null;
    const updatedOrderResult = await client.query(
      `UPDATE orders
       SET status = 'cancelled', cancelled_by = $1, cancel_reason = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [req.user.id, cancelReason, orderId]
    );

    await client.query(
      `UPDATE payments SET status = 'cancelled', updated_at = now() WHERE order_id = $1 AND status = 'pending'`,
      [orderId]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_at)
       VALUES ($1, $2, 'cancelled', $3, now())`,
      [orderId, order.status, req.user.id]
    );

    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'order_cancelled', 'order', $2, $3)`,
      [req.user.id, orderId, JSON.stringify({ reason: cancelReason, fromStatus: order.status })]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: updatedOrderResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

const requestReturn = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId || req.params.id;
  const { reason } = req.body;
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `SELECT id, buyer_id, status, delivered_at, updated_at FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order || order.buyer_id !== req.user.id) {
      throw new AppError('Order not found', 404);
    }
    if (order.status !== 'delivered') {
      throw new AppError('Order cannot be returned unless delivered', 409);
    }
    if (!order.delivered_at) {
      throw new AppError('Order delivery timestamp is missing', 409);
    }

    const returnWindowDays = parseInt(process.env.RETURN_WINDOW_DAYS, 10) || 10;
    const windowMs = returnWindowDays * 24 * 60 * 60 * 1000;
    const deliveredAtTime = new Date(order.delivered_at).getTime();
    if (Date.now() - deliveredAtTime > windowMs) {
      throw new AppError(`Return window of ${returnWindowDays} day(s) has expired`, 400);
    }

    const returnMaxAttempts = !isNaN(parseInt(process.env.RETURN_MAX_ATTEMPTS, 10))
      ? parseInt(process.env.RETURN_MAX_ATTEMPTS, 10)
      : 2;

    const returnCountResult = await client.query(
      `SELECT COUNT(*)::int AS count FROM return_requests WHERE order_id = $1`,
      [orderId]
    );
    const returnCount = returnCountResult.rows[0]?.count || 0;
    if (returnCount >= returnMaxAttempts) {
      throw new AppError(`Maximum return request attempts (${returnMaxAttempts}) reached for this order`, 409);
    }

    const activeReturnResult = await client.query(
      `SELECT id FROM return_requests
       WHERE order_id = $1 AND status IN ('requested', 'approved', 'received')
       FOR UPDATE`,
      [orderId]
    );
    if (activeReturnResult.rows.length > 0) {
      throw new AppError('An active return request already exists for this order', 409);
    }

    const newReturn = await client.query(
      `INSERT INTO return_requests (order_id, buyer_id, reason, status)
       VALUES ($1, $2, $3, 'requested') RETURNING *`,
      [orderId, req.user.id, reason]
    );

    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'return_requested', 'return_request', $2, $3)`,
      [req.user.id, newReturn.rows[0].id, JSON.stringify({ orderId, reason })]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: newReturn.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      throw new AppError('An active return request already exists for this order', 409);
    }
    throw err;
  } finally {
    client.release();
  }
});

const getDeliveryOtp = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId || req.params.id;
  const orderResult = await db.query(
    `SELECT id, buyer_id, status FROM orders WHERE id = $1`,
    [orderId]
  );
  const order = orderResult.rows[0];
  if (!order || order.buyer_id !== req.user.id) {
    throw new AppError('Order not found', 404);
  }
  if (order.status !== 'out_for_delivery') {
    throw new AppError('Delivery code is only available when order is out for delivery', 409);
  }

  const otpResult = await db.query(
    `SELECT otp_ciphertext FROM order_delivery_otps WHERE order_id = $1`,
    [orderId]
  );
  const otpRow = otpResult.rows[0];
  if (!otpRow || !otpRow.otp_ciphertext) {
    throw new AppError('Delivery code not found or already verified', 409);
  }

  const otp = decryptOtp(otpRow.otp_ciphertext);
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, otp, data: { otp } });
});

const regenerateDeliveryOtp = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId || req.params.id;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `SELECT id, buyer_id, status FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order || order.buyer_id !== req.user.id) {
      throw new AppError('Order not found', 404);
    }
    if (order.status !== 'out_for_delivery') {
      throw new AppError('Delivery code can only be regenerated when order is out for delivery', 409);
    }

    const otpResult = await client.query(
      `SELECT order_id, otp_ciphertext, failed_attempts, locked_at, regenerated_count
       FROM order_delivery_otps WHERE order_id = $1 FOR UPDATE`,
      [orderId]
    );
    const otpRow = otpResult.rows[0];
    if (!otpRow) {
      throw new AppError('Delivery code record not found', 409);
    }
    if (otpRow.locked_at !== null || otpRow.failed_attempts >= 5) {
      throw new AppError('Cannot regenerate delivery code because order is locked', 409);
    }
    if (otpRow.regenerated_count >= 3) {
      throw new AppError('Maximum regeneration limit of 3 reached for this order', 409);
    }

    const newOtp = generateOtp();
    const newCiphertext = encryptOtp(newOtp);

    await client.query(
      `UPDATE order_delivery_otps
       SET otp_ciphertext = $1,
           generated_at = now(),
           failed_attempts = 0,
           regenerated_count = regenerated_count + 1
       WHERE order_id = $2`,
      [newCiphertext, orderId]
    );

    await client.query('COMMIT');
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, otp: newOtp, data: { otp: newOtp } });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = {
  create,
  updateStatus,
  myOrders,
  rateMechanic,
  cancelOrder,
  requestReturn,
  getDeliveryOtp,
  regenerateDeliveryOtp,
};
