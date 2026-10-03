const config = require('../config/env');

function notFound(req, res, next) {
  const msg = 'Route not found';
  res.status(404).json({ success: false, error: msg, message: msg });
}

function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message);
  const isProd = config.nodeEnv === 'production';

  // Body payload too large (from express.json() / express.urlencoded())
  if (err.type === 'entity.too.large') {
    const msg = `Request payload too large. Maximum allowed size is ${config.bodyLimit || '1mb'}.`;
    return res.status(413).json({
      success: false,
      error: msg,
      message: msg,
    });
  }

  // Malformed JSON body: treat as malformed JSON ONLY when err.type === 'entity.parse.failed'
  if (err.type === 'entity.parse.failed') {
    const msg = 'Malformed JSON in request body.';
    return res.status(400).json({
      success: false,
      error: msg,
      message: msg,
    });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE' || (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE')) {
    const msg = 'File size limit exceeded. Maximum allowed size is 5MB.';
    return res.status(413).json({
      success: false,
      error: msg,
      message: msg,
    });
  }

  if (err.name === 'MulterError' || err.message === 'Only image files are allowed') {
    const msg = err.message || 'Invalid file upload.';
    return res.status(400).json({
      success: false,
      error: msg,
      message: msg,
    });
  }

  const status = err.statusCode || err.status || 500;
  const msg = isProd && status === 500 ? 'Something went wrong' : err.message;
  res.status(status).json({
    success: false,
    error: msg,
    message: msg,
  });
}

module.exports = { notFound, errorHandler };
