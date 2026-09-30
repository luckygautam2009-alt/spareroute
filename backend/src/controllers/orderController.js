const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const create = asyncHandler(async (req, res) => {
  const { productId, quantity, deliveryAddress, deliveryLatitude, deliveryLongitude, mechanicId } = req.body;
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

    let serviceFeePaise = 0;
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
      serviceFeePaise = mechanic.service_fee_paise;
    }

    await client.query(
      `UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = now() WHERE id = $2`,
      [quantity, productId]
    );

    const totalAmountPaise = product.price_paise * quantity;

    const orderResult = await client.query(
      `INSERT INTO orders
         (buyer_id, seller_id, total_amount_paise, delivery_address, delivery_latitude, delivery_longitude,
          mechanic_id, service_fee_paise)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, product.seller_id, totalAmountPaise, deliveryAddress,
       deliveryLatitude || null, deliveryLongitude || null, mechanicId || null, serviceFeePaise]
    );
    const order = orderResult.rows[0];

    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price_paise)
       VALUES ($1, $2, $3, $4)`,
      [order.id, product.id, quantity, product.price_paise]
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
  const sellerResult = await db.query('SELECT id FROM sellers WHERE user_id = $1', [req.user.id]);
  const seller = sellerResult.rows[0];
  if (!seller) throw new AppError('Seller profile not found', 404);
  const result = await db.query(
    `UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 AND seller_id = $3 RETURNING *`,
    [status, orderId, seller.id]
  );
  if (result.rows.length === 0) throw new AppError('Order not found or does not belong to you', 404);
  res.json({ success: true, data: result.rows[0] });
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

module.exports = { create, updateStatus, myOrders, rateMechanic };
