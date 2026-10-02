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

if (process.env.NODE_ENV === 'production' && process.env.JWT_ACCESS_SECRET.length < 32) {
  console.error('[config] FATAL: JWT_ACCESS_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

module.exports = {
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiApiKeyBackup: process.env.GEMINI_API_KEY_BACKUP || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  spareRouteApiUrl: process.env.SPAREROUTE_API_URL.replace(/\/+$/, ''),
  spareRouteInternalApiKey: process.env.SPAREROUTE_INTERNAL_API_KEY,
  bodyLimit: process.env.BODY_LIMIT || '1mb',
};
