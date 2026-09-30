const jwt = require('jsonwebtoken');
const config = require('../config/env');

function deny(res, status, error) {
  return res.status(status).json({ success: false, error });
}

// Verifies the access token issued by SpareRoute (same signing secret),
// then asks SpareRoute whether that user is STILL active and what their
// role is right now. Signature alone is not enough: a token stays valid
// for 15 minutes, so without the live check a disabled user (or one whose
// role changed) would keep access until the token expires.
async function requireAuth(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return deny(res, 401, 'Authentication required');
    }

    let payload;
    try {
      // Pin the algorithm: never let the token choose how it is verified.
      payload = jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'] });
    } catch {
      return deny(res, 401, 'Invalid or expired token');
    }
    if (typeof payload.sub !== 'string') {
      return deny(res, 401, 'Invalid token');
    }

    const upstream = await fetch(
      `${config.spareRouteApiUrl}/api/internal/users/${encodeURIComponent(payload.sub)}/auth-status`,
      {
        headers: { 'x-internal-api-key': config.spareRouteInternalApiKey },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (upstream.status === 404 || upstream.status === 400) {
      return deny(res, 401, 'Account not found');
    }
    if (!upstream.ok) {
      // Fail closed: if we cannot confirm the user, we do not let them in.
      return deny(res, 503, 'Authentication service unavailable');
    }

    const { data } = await upstream.json();
    if (!data.isActive) {
      return deny(res, 401, 'Account disabled');
    }

    // Role comes from the database, not from the token claim.
    req.user = { id: data.id, role: data.role };
    next();
  } catch (err) {
    console.error('[auth] verification failed:', err.message);
    return deny(res, 503, 'Authentication service unavailable');
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return deny(res, 401, 'Authentication required');
    if (!roles.includes(req.user.role)) {
      return deny(res, 403, 'You do not have permission to do this');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
