const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// General API traffic
const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Much stricter limit on login/register/OTP endpoints specifically —
// this is what actually stops password brute-forcing and OTP spam,
// the general limiter alone is not enough.
const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait before trying again.' },
});

module.exports = { apiLimiter, authLimiter };
