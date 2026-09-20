const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Placing an order does 3 things that MUST succeed or fail together:
// 1) lock + check + decrement stock, 2) create the order,
// 3) create the order_item. We use a real DB transaction with
// SELECT ... FOR UPDATE so two buyers can't both "win" the last unit
// of stock at the same time (a classic race condition in naive
// e-commerce backends).
const create = asyncHandler(async (req, res) => {
  const { productId, quantity, deliveryAddress, deliveryLatitude, deliveryLongitude } = req.body;
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      `SELECT id, seller_id, price_paise, stock_quantity, is_active
       FROM products WHERE id = $1 FOR UPDATE`,
      [productId]
    );
    const product = productResult.rows[0];

    if (!product || !product.is_active) {
      throw new AppError('Product not found', 404);
    }
    if (product.stock_quantity < quantity) {
      throw new AppError(
        `Only ${product.stock_quantity} unit(s) left in stock`,
        409
      );
    }

    await client.query(
      `UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = now()
       WHERE id = $2`,
      [quantity, productId]
    );

    const totalAmountPaise = product.price_paise * quantity;

    const orderResult = await client.query(
      `INSERT INTO orders
         (buyer_id, seller_id, total_amount_paise, delivery_address, delivery_latitude, delivery_longitude)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, product.seller_id, totalAmountPaise, deliveryAddress, deliveryLatitude || null, deliveryLongitude || null]
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

// Seller accepts/rejects/updates their own order only — ownership is
// enforced in the SQL WHERE clause, not just checked in JS, so it
// can't be bypassed.
const updateStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const sellerResult = await db.query('SELECT id FROM sellers WHERE user_id = $1', [req.user.id]);
  const seller = sellerResult.rows[0];
  if (!seller) throw new AppError('Seller profile not found', 404);

  const result = await db.query(
    `UPDATE orders SET status = $1, updated_at = now()
     WHERE id = $2 AND seller_id = $3
     RETURNING *`,
    [status, orderId, seller.id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Order not found or does not belong to you', 404);
  }

  res.json({ success: true, data: result.rows[0] });
});

const myOrders = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ success: true, data: result.rows });
});

module.exports = { create, updateStatus, myOrders };
