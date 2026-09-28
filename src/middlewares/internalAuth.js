const AppError = require('../utils/AppError');

function requireInternalApiKey(req, res, next) {
  const provided = req.headers['x-internal-api-key'];
  const expected = process.env.INTERNAL_API_KEY;

  if (!expected) {
    return next(new AppError('Internal API is not configured', 503));
  }
  if (!provided || provided !== expected) {
    return next(new AppError('Invalid internal API key', 401));
  }
  next();
}

module.exports = requireInternalApiKey;
