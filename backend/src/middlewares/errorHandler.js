const logger = require('../utils/logger');
const env = require('../config/env');

// Must be registered LAST in app.js (after all routes).
function errorHandler(err, req, res, next) {
  const isOperational = err.isOperational === true;
  const statusCode = err.statusCode || err.status || 500;

  logger.error(err.message, {
    path: req.originalUrl,
    method: req.method,
    statusCode,
    stack: env.nodeEnv !== 'production' ? err.stack : undefined,
  });

  // Body payload too large
  if (err.type === 'entity.too.large') {
    const msg = 'Request payload too large.';
    return res.status(413).json({
      success: false,
      error: msg,
      message: msg,
    });
  }

  // Malformed JSON
  if (err.type === 'entity.parse.failed') {
    const msg = 'Malformed JSON in request body.';
    return res.status(400).json({
      success: false,
      error: msg,
      message: msg,
    });
  }

  // In production, never leak internal error details for unexpected
  // (non-operational) errors — that's how attackers learn your stack,
  // ORM, table names, etc.
  const message =
    isOperational || env.nodeEnv !== 'production'
      ? err.message
      : 'Something went wrong. Please try again later.';

  res.status(statusCode).json({
    success: false,
    error: message,
    message,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: 'Route not found', message: 'Route not found' });
}

module.exports = { errorHandler, notFoundHandler };
