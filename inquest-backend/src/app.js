const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/env');
const { pool } = require('./db/connection');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health.routes');
const contextRoutes = require('./routes/context.routes');
const complaintRoutes = require('./routes/complaint.routes');
const verificationRoutes = require('./routes/verification.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.set('trust proxy', config.trustProxy);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    // Allow origins in CORS_ORIGIN
    if (config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow http://localhost:* only in non-production environments
    if (config.nodeEnv !== 'production' && origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    // Reject other origins
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use('/api', apiLimiter);

app.use('/api/health', healthRoutes);
app.use('/api/customers', contextRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/verify', verificationRoutes);
app.use('/api/admin', adminRoutes);

// Health and Readiness probes
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', message: 'INQUEST backend is alive 🟢' });
});

// Readiness probe: verifies DB connectivity; returns 503 if DB is unavailable
app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, status: 'ready' });
  } catch (err) {
    res.status(503).json({ success: false, status: 'not ready', error: 'Database unavailable' });
  }
});

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`🚀 INQUEST backend running on port ${config.port} [${config.nodeEnv}]`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  console.log(`[inquest] ${signal} received — starting graceful shutdown`);
  server.close(async () => {
    console.log('[inquest] HTTP server closed');
    try {
      await pool.end();
      console.log('[inquest] PostgreSQL pool closed');
    } catch (err) {
      console.error('[inquest] Error closing PostgreSQL pool:', err.message);
    }
    process.exit(0);
  });
  // Force-kill after 30 s
  setTimeout(() => {
    console.error('[inquest] Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 30000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[inquest] Unhandled promise rejection:', reason?.message || reason);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('[inquest] Uncaught exception:', err.message, err.stack);
  process.exit(1);
});

module.exports = { app, server };
