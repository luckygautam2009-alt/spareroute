const env = require('./config/env'); // validates env vars first, exits if missing
const app = require('./app');
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
