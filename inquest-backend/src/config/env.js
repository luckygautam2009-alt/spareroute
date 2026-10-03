require('dotenv').config();

const required = [
  'PORT',
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'SPAREROUTE_API_URL',
  'SPAREROUTE_INTERNAL_API_KEY',
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[config] FATAL: missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isStaging = nodeEnv === 'staging';

// ── Production safety guards (fail fast) ─────────────────────────────────────
if (isProduction) {
  // 1. No localhost or wildcard CORS origins
  const origins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim());
  const unsafeOrigin = origins.find((o) => o === '*' || o.includes('localhost') || o.includes('127.0.0.1'));
  if (unsafeOrigin) {
    console.error(`[config] FATAL [production]: CORS_ORIGIN must not contain "${unsafeOrigin}" in production.`);
    process.exit(1);
  }

  // 2. Secrets >= 32 chars and no placeholder values
  const secrets = {
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    SPAREROUTE_INTERNAL_API_KEY: process.env.SPAREROUTE_INTERNAL_API_KEY,
  };
  const placeholders = ['changeme', 'secret', 'example', 'placeholder', 'your_secret', 'your-secret'];
  for (const [key, value] of Object.entries(secrets)) {
    if (!value || value.length < 32) {
      console.error(`[config] FATAL [production]: ${key} must be at least 32 characters.`);
      process.exit(1);
    }
    if (placeholders.some((p) => value.toLowerCase().includes(p))) {
      console.error(`[config] FATAL [production]: ${key} appears to contain a placeholder value.`);
      process.exit(1);
    }
  }
}

if (isProduction && process.env.JWT_ACCESS_SECRET.length < 32) {
  console.error('[config] FATAL: JWT_ACCESS_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

module.exports = {
  port: process.env.PORT,
  nodeEnv,
  corsOrigins,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiApiKeyBackup: process.env.GEMINI_API_KEY_BACKUP || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  spareRouteApiUrl: process.env.SPAREROUTE_API_URL.replace(/\/+$/, ''),
  spareRouteInternalApiKey: process.env.SPAREROUTE_INTERNAL_API_KEY,
  bodyLimit: process.env.BODY_LIMIT || '1mb',
  trustProxy: process.env.TRUST_PROXY ? parseInt(process.env.TRUST_PROXY, 10) : 0,
  rateLimitComplaintsMax: parseInt(process.env.RATE_LIMIT_COMPLAINTS_MAX, 10) || 10,
  rateLimitVerifyMax: parseInt(process.env.RATE_LIMIT_VERIFY_MAX, 10) || 20,
};
