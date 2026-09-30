function notFound(req, res, next) {
  res.status(404).json({ success: false, error: 'Route not found' });
}

function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message);
  const isProd = process.env.NODE_ENV === 'production';

  // Body payload too large (from express.json() limit)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Request payload too large. Maximum allowed size is 10kb.',
    });
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON in request body.',
    });
  }

  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: isProd ? 'Something went wrong' : err.message,
  });
}

module.exports = { notFound, errorHandler };
