const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config/env');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, slow down.', message: 'Too many requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const userComplaintsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.rateLimitComplaintsMax,
  keyGenerator: (req) => (req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many complaints submitted, please try again later.',
    message: 'Too many complaints submitted, please try again later.',
  },
});

const userVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.rateLimitVerifyMax,
  keyGenerator: (req) => (req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many verification attempts, please try again later.',
    message: 'Too many verification attempts, please try again later.',
  },
});

module.exports = { apiLimiter, userComplaintsLimiter, userVerifyLimiter };
