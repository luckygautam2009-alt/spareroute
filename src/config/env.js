// Centralized env loading + validation.
// The app refuses to start if a required secret is missing —
// this prevents "it works but JWT_SECRET is undefined" style holes.

require('dotenv').config();

const required = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  // Fail fast and loud. Never let the server start with silent
  // undefined secrets — that's how "secure" apps end up signing
  // JWTs with the string "undefined".
  console.error(
    `FATAL: Missing required environment variables: ${missing.join(', ')}`
  );
  process.exit(1);
}

if (
  process.env.NODE_ENV === 'production' &&
  (process.env.JWT_ACCESS_SECRET.length < 32 ||
    process.env.JWT_REFRESH_SECRET.length < 32)
) {
  console.error('FATAL: JWT secrets must be at least 32 characters in production.');
  process.exit(1);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim()),
  kyc: {
    providerName: process.env.KYC_PROVIDER_NAME || 'stub',
    apiKey: process.env.KYC_PROVIDER_API_KEY,
    apiSecret: process.env.KYC_PROVIDER_API_SECRET,
    baseUrl: process.env.KYC_PROVIDER_BASE_URL,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 5,
  },
};
