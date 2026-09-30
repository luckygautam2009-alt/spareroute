const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Business rule enforced HERE, not just in the UI: only sellers whose
// Aadhaar KYC is verified AND who are admin-approved can list products.
// This is checked server-side on every write so it can't be bypassed
// by calling the API directly.
async function getApprovedSellerOrThrow(userId) {
  const result = await db.query(
    `SELECT id, kyc_status, is_approved FROM sellers WHERE user_id = $1`,
    [userId]
  );
  const seller = result.rows[0];
  if (!seller) throw new AppError('Seller profile not found', 404);
  if (seller.kyc_status !== 'verified') {
    throw new AppError('Complete Aadhaar verification before listing products', 403);
  }
  if (!seller.is_approved) {
    throw new AppError('Your seller account is pending admin approval', 403);
  }
  return seller;
}

const create = asyncHandler(async (req, res) => {
  const seller = await getApprovedSellerOrThrow(req.user.id);
  const { name, oemPartNumber, compatiblePartNumbers, brand, category, pricePaise, stockQuantity } =
    req.body;

  const result = await db.query(
    `INSERT INTO products
       (seller_id, name, oem_part_number, compatible_part_numbers, brand, category, price_paise, stock_quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      seller.id,
      name,
      oemPartNumber || null,
      compatiblePartNumbers || [],
      brand || null,
      category || null,
      pricePaise,
      stockQuantity,
    ]
  );

  res.status(201).json({ success: true, data: result.rows[0] });
});

const updateStock = asyncHandler(async (req, res) => {
  const seller = await getApprovedSellerOrThrow(req.user.id);
  const { stockQuantity } = req.body;
  const { productId } = req.params;

  // WHERE seller_id = $3 ensures a seller can only ever update THEIR
  // OWN product, even if they guess/enumerate another product's ID.
  const result = await db.query(
    `UPDATE products SET stock_quantity = $1, updated_at = now()
     WHERE id = $2 AND seller_id = $3
     RETURNING *`,
    [stockQuantity, productId, seller.id]
  );

  if (result.rows.length === 0) {
    throw new AppError('Product not found or you do not own it', 404);
  }

  res.json({ success: true, data: result.rows[0] });
});

// Public/buyer-facing search — only returns products from active,
// approved, KYC-verified sellers.
const search = asyncHandler(async (req, res) => {
  const { query, oemPartNumber, category } = req.query;

  const conditions = ["p.is_active = TRUE", "s.kyc_status = 'verified'", "s.is_approved = TRUE"];
  const params = [];

  if (oemPartNumber) {
    params.push(oemPartNumber);
    conditions.push(`(p.oem_part_number = $${params.length} OR $${params.length} = ANY(p.compatible_part_numbers))`);
  }
  if (category) {
    params.push(category);
    conditions.push(`p.category = $${params.length}`);
  }
  if (query) {
    params.push(`%${query}%`);
    conditions.push(`p.name ILIKE $${params.length}`);
  }

  const sql = `
    SELECT p.*, s.business_name, s.city
    FROM products p
    JOIN sellers s ON s.id = p.seller_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY p.created_at DESC
    LIMIT 50
  `;

  const result = await db.query(sql, params);
  res.json({ success: true, data: result.rows });
});

module.exports = { create, updateStock, search };
