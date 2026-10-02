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

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isStaging = nodeEnv === 'staging';

// ── Production safety guards (fail fast) ─────────────────────────────────────
if (isProduction) {
  const secrets = {
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  };

  // 1. KYC must not be the stub provider in production
  if ((process.env.KYC_PROVIDER_NAME || 'stub') === 'stub') {
    console.error('FATAL [production]: KYC_PROVIDER_NAME must not be "stub" in production. Configure a real KYC provider.');
    process.exit(1);
  }

  // 2. No localhost or wildcard origins in production
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim());
  const unsafeOrigin = origins.find((o) => o === '*' || o.includes('localhost') || o.includes('127.0.0.1'));
  if (unsafeOrigin) {
    console.error(`FATAL [production]: ALLOWED_ORIGINS must not contain "${unsafeOrigin}" in production.`);
    process.exit(1);
  }

  // 3. Secrets must be >= 32 chars and not placeholder values
  const placeholders = ['changeme', 'secret', 'example', 'placeholder', 'your_secret', 'your-secret'];
  for (const [key, value] of Object.entries(secrets)) {
    if (!value || value.length < 32) {
      console.error(`FATAL [production]: ${key} must be at least 32 characters.`);
      process.exit(1);
    }
    if (placeholders.some((p) => value.toLowerCase().includes(p))) {
      console.error(`FATAL [production]: ${key} appears to contain a placeholder value.`);
      process.exit(1);
    }
  }
}

// ── Staging warning ───────────────────────────────────────────────────────────
if (isStaging && (process.env.KYC_PROVIDER_NAME || 'stub') === 'stub') {
  console.warn('⚠️  WARNING [staging]: KYC_PROVIDER_NAME is "stub". This is acceptable for staging but MUST be a real provider in production.');
}

// ── JWT secret length in production is already covered above, but ─────────────
// keep a lighter check for other envs too
if (
  isProduction &&
  (process.env.JWT_ACCESS_SECRET.length < 32 ||
    process.env.JWT_REFRESH_SECRET.length < 32)
) {
  console.error('FATAL: JWT secrets must be at least 32 characters in production.');
  process.exit(1);
}

module.exports = {
  nodeEnv,
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
  trustProxy: process.env.TRUST_PROXY ? parseInt(process.env.TRUST_PROXY, 10) : 0,
};
