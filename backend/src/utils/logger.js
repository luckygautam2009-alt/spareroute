const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Redact common sensitive keys from any logged object so nobody
// accidentally logs a password, token, or Aadhaar-related field.
const SENSITIVE_KEYS = ['password', 'token', 'accessToken', 'refreshToken', 'aadhaar', 'otp'];

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(clone)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object') {
      clone[key] = redact(clone[key]);
    }
  }
  return clone;
}

module.exports = {
  info: (msg, meta) => logger.info(msg, redact(meta)),
  warn: (msg, meta) => logger.warn(msg, redact(meta)),
  error: (msg, meta) => logger.error(msg, redact(meta)),
  debug: (msg, meta) => logger.debug(msg, redact(meta)),
};
