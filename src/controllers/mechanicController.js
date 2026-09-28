const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function getOwnSellerOrThrow(userId) {
  const result = await db.query('SELECT id FROM sellers WHERE user_id = $1', [userId]);
  const seller = result.rows[0];
  if (!seller) throw new AppError('Seller profile not found', 404);
  return seller;
}

const create = asyncHandler(async (req, res) => {
  const seller = await getOwnSellerOrThrow(req.user.id);
  const { name, phone, serviceFeePaise } = req.body;
  const result = await db.query(
    `INSERT INTO mechanics (seller_id, name, phone, service_fee_paise)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [seller.id, name, phone, serviceFeePaise]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
});

const myMechanics = asyncHandler(async (req, res) => {
  const seller = await getOwnSellerOrThrow(req.user.id);
  const result = await db.query(
    `SELECT * FROM mechanics WHERE seller_id = $1 ORDER BY created_at DESC`,
    [seller.id]
  );
  res.json({ success: true, data: result.rows });
});

const update = asyncHandler(async (req, res) => {
  const seller = await getOwnSellerOrThrow(req.user.id);
  const { mechanicId } = req.params;
  const { name, serviceFeePaise, isActive } = req.body;
  const result = await db.query(
    `UPDATE mechanics SET
       name = COALESCE($1, name),
       service_fee_paise = COALESCE($2, service_fee_paise),
       is_active = COALESCE($3, is_active),
       updated_at = now()
     WHERE id = $4 AND seller_id = $5 RETURNING *`,
    [name || null, serviceFeePaise ?? null, isActive ?? null, mechanicId, seller.id]
  );
  if (result.rows.length === 0) {
    throw new AppError('Mechanic not found or does not belong to you', 404);
  }
  res.json({ success: true, data: result.rows[0] });
});

const listForSeller = asyncHandler(async (req, res) => {
  const { sellerId } = req.params;
  const result = await db.query(
    `SELECT id, name, service_fee_paise, avg_rating, total_ratings
     FROM mechanics WHERE seller_id = $1 AND is_active = TRUE
     ORDER BY avg_rating DESC`,
    [sellerId]
  );
  res.json({ success: true, data: result.rows });
});

module.exports = { create, myMechanics, update, listForSeller };
