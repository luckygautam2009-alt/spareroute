const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const getKycProvider = require('../services/kyc/kycProviderFactory');
const env = require('../config/env');
const logger = require('../utils/logger');

// Step 1: seller submits Aadhaar number -> we call the provider to
// start verification (e.g. it sends an OTP to the Aadhaar-linked phone).
// The raw Aadhaar number is used only in-memory for this one call and
// is NEVER written to our database.
const initiate = asyncHandler(async (req, res) => {
  const { aadhaarNumber } = req.body;

  const sellerResult = await db.query(
    'SELECT id FROM sellers WHERE user_id = $1',
    [req.user.id]
  );
  const seller = sellerResult.rows[0];
  if (!seller) {
    throw new AppError('Seller profile not found for this account', 404);
  }

  const provider = getKycProvider();
  const { referenceId, status } = await provider.initiateVerification({
    aadhaarNumber,
    sellerId: seller.id,
  });

  await db.query(
    `UPDATE sellers
     SET kyc_status = 'pending', kyc_provider = $1, kyc_reference_id = $2
     WHERE id = $3`,
    [env.kyc.providerName, referenceId, seller.id]
  );

  logger.info('KYC verification initiated', { sellerId: seller.id, referenceId });

  // aadhaarNumber deliberately never appears in the response.
  res.json({ success: true, data: { referenceId, status } });
});

// Step 2: seller submits OTP -> we confirm with the provider and
// persist only the resulting status.
const confirm = asyncHandler(async (req, res) => {
  const { referenceId, otp } = req.body;

  const sellerResult = await db.query(
    'SELECT id, kyc_reference_id FROM sellers WHERE user_id = $1',
    [req.user.id]
  );
  const seller = sellerResult.rows[0];
  if (!seller) {
    throw new AppError('Seller profile not found for this account', 404);
  }
  if (seller.kyc_reference_id !== referenceId) {
    throw new AppError('This verification reference does not match your account', 400);
  }

  const provider = getKycProvider();
  const { status, verifiedName } = await provider.confirmVerification({ referenceId, otp });

  await db.query(
    `UPDATE sellers
     SET kyc_status = $1::kyc_status,
         kyc_verified_at = CASE WHEN $1::text = 'verified' THEN now() ELSE kyc_verified_at END,
         kyc_name_on_id = $2
     WHERE id = $3`,
    [status, verifiedName || null, seller.id]
  );

  logger.info('KYC verification confirmed', { sellerId: seller.id, status });

  res.json({ success: true, data: { status } });
});

const status = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT kyc_status, kyc_verified_at, is_approved
     FROM sellers WHERE user_id = $1`,
    [req.user.id]
  );
  if (result.rows.length === 0) {
    throw new AppError('Seller profile not found for this account', 404);
  }
  res.json({ success: true, data: result.rows[0] });
});

module.exports = { initiate, confirm, status };
