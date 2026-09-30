const AppError = require('../utils/AppError');
const tokenService = require('../services/tokenService');
const db = require('../config/db');

// Requires a valid, non-expired access token in the Authorization
// header: "Authorization: Bearer <token>"
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError('Authentication required', 401);
    }

    let payload;
    try {
      payload = tokenService.verifyAccessToken(token);
    } catch (err) {
      throw new AppError('Invalid or expired token', 401);
    }

    // Re-check the user still exists and is active on every request.
    // This means disabling/deleting a user immediately locks them out,
    // even if their access token hasn't expired yet.
    const result = await db.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = result.rows[0];

    if (!user || !user.is_active) {
      throw new AppError('Account not found or disabled', 401);
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
