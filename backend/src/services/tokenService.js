const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const db = require('../config/db');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiry }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiry }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret); // throws if invalid/expired
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

// We never store the raw refresh token in the DB — only its hash.
// This means a leaked database dump alone can't be replayed as a
// valid refresh token.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function storeRefreshToken(userId, refreshToken) {
  const decoded = jwt.decode(refreshToken);
  const expiresAt = new Date(decoded.exp * 1000);
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashToken(refreshToken), expiresAt]
  );
}

async function isRefreshTokenValid(userId, refreshToken) {
  const result = await db.query(
    `SELECT id FROM refresh_tokens
     WHERE user_id = $1 AND token_hash = $2 AND revoked = FALSE AND expires_at > now()`,
    [userId, hashToken(refreshToken)]
  );
  return result.rows.length > 0;
}

async function revokeRefreshToken(userId, refreshToken) {
  await db.query(
    `UPDATE refresh_tokens SET revoked = TRUE
     WHERE user_id = $1 AND token_hash = $2`,
    [userId, hashToken(refreshToken)]
  );
}

async function revokeAllUserTokens(userId) {
  // Use on password change / suspected compromise: kills every
  // existing session for that user.
  await db.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`,
    [userId]
  );
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  storeRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
  revokeAllUserTokens,
};
