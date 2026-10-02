const env = require('./config/env'); // validates env vars first, exits if missing
const app = require('./app');
const { pool } = require('./config/db');
const logger = require('./utils/logger');

const server = app.listen(env.port, () => {
  logger.info(`Server running on port ${env.port} [${env.nodeEnv}]`);
});

// Don't let one uncaught error silently kill the process without a trace.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || reason });
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// On SIGTERM/SIGINT: stop accepting new connections, wait for in-flight
// requests to finish, then close the DB pool cleanly.
async function gracefulShutdown(signal) {
  logger.info(`${signal} received — starting graceful shutdown`);
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await pool.end();
      logger.info('PostgreSQL pool closed');
    } catch (err) {
      logger.error('Error closing PostgreSQL pool', { error: err.message });
    }
    process.exit(0);
  });
  // Force-kill after 30 s in case a request hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 30000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
