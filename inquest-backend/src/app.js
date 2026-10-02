const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health.routes');
const contextRoutes = require('./routes/context.routes');
const complaintRoutes = require('./routes/complaint.routes');
const verificationRoutes = require('./routes/verification.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

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

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`🚀 INQUEST backend running on port ${config.port} [${config.nodeEnv}]`);
});

module.exports = { app, server };
