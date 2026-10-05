const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const env = require('../config/env');

// General API traffic
const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.', message: 'Too many requests, please try again later.' },
});

// Much stricter limit on login/register/OTP endpoints specifically —
// this is what actually stops password brute-forcing and OTP spam,
// the general limiter alone is not enough.
const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts. Please wait before trying again.', message: 'Too many attempts. Please wait before trying again.' },
});

const deliveryOtpLimiter = rateLimit({
  windowMs: parseInt(process.env.DELIVERY_OTP_RATE_LIMIT_WINDOW_MS, 10) || 60 * 60 * 1000,
  max: parseInt(process.env.DELIVERY_OTP_RATE_LIMIT_MAX, 10) || 30,
  keyGenerator: (req) => (req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many delivery code requests, please try again later.', message: 'Too many delivery code requests, please try again later.' },
});

module.exports = { apiLimiter, authLimiter, deliveryOtpLimiter };

