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

module.exports = { listPendingSellers, approveSeller };
