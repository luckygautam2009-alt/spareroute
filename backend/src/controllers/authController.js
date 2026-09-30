const bcrypt = require('bcryptjs');
const db = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const tokenService = require('../services/tokenService');
const logger = require('../utils/logger');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const register = asyncHandler(async (req, res) => {
  const { fullName, phone, email, password, role } = req.body;

  const existing = await db.query(
    'SELECT id FROM users WHERE phone = $1 OR ($2::text IS NOT NULL AND email = $2)',
    [phone, email || null]
  );
  if (existing.rows.length > 0) {
    throw new AppError('An account with this phone or email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);

  const result = await db.query(
    `INSERT INTO users (full_name, phone, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, full_name, phone, email, role, created_at`,
    [fullName, phone, email || null, passwordHash, role]
  );

  const user = result.rows[0];

  // If registering as a seller, create the linked sellers row so the
  // seller-onboarding/KYC flow has somewhere to write to.
  if (role === 'seller') {
    await db.query(
      `INSERT INTO sellers (user_id, business_name) VALUES ($1, $2)`,
      [user.id, fullName]
    );
  }

  await issueTokensAndRespond(res, user, 201);
});

const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  const result = await db.query(
    `SELECT id, full_name, phone, email, role, password_hash,
            failed_login_attempts, locked_until, is_active
     FROM users WHERE phone = $1`,
    [phone]
  );
  const user = result.rows[0];

  // Use the SAME generic error whether the phone doesn't exist or the
  // password is wrong. This stops attackers from enumerating which
  // phone numbers have accounts.
  const genericError = () => new AppError('Invalid phone number or password', 401);

  if (!user || !user.is_active) {
    throw genericError();
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new AppError(
      `Account temporarily locked due to failed login attempts. Try again in ${minutesLeft} minute(s).`,
      423
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    const attempts = user.failed_login_attempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

    await db.query(
      `UPDATE users SET failed_login_attempts = $1,
              locked_until = $2
       WHERE id = $3`,
      [
        shouldLock ? 0 : attempts,
        shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null,
        user.id,
      ]
    );

    if (shouldLock) {
      logger.warn('Account locked after repeated failed logins', { userId: user.id });
    }

    throw genericError();
  }

  // Successful login — reset the failed-attempt counter.
  await db.query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
    [user.id]
  );

  await issueTokensAndRespond(res, user, 200);
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = tokenService.verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const isValid = await tokenService.isRefreshTokenValid(payload.sub, refreshToken);
  if (!isValid) {
    throw new AppError('Refresh token has been revoked or is invalid', 401);
  }

  const result = await db.query(
    'SELECT id, role, is_active FROM users WHERE id = $1',
    [payload.sub]
  );
  const user = result.rows[0];
  if (!user || !user.is_active) {
    throw new AppError('Account not found or disabled', 401);
  }

  // Rotate: revoke the old refresh token, issue a brand new pair.
  // This limits the damage if a refresh token is ever stolen.
  await tokenService.revokeRefreshToken(user.id, refreshToken);

  const accessToken = tokenService.signAccessToken(user);
  const newRefreshToken = tokenService.signRefreshToken(user);
  await tokenService.storeRefreshToken(user.id, newRefreshToken);

  res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await tokenService.revokeRefreshToken(req.user.id, refreshToken);
  }
  res.json({ success: true, message: 'Logged out' });
});

async function issueTokensAndRespond(res, user, statusCode) {
  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = tokenService.signRefreshToken(user);
  await tokenService.storeRefreshToken(user.id, refreshToken);

  res.status(statusCode).json({
    success: true,
    data: {
      user: {
        id: user.id,
        fullName: user.full_name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    },
  });
}

module.exports = { register, login, refresh, logout };
