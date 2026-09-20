const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const AppError = require('./utils/AppError');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiters');

const authRoutes = require('./routes/authRoutes');
const kycRoutes = require('./routes/kycRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');

const app = express();

// Sets ~15 security-related HTTP headers (X-Frame-Options, HSTS,
// disables X-Powered-By, etc). Always first.
app.use(helmet());

// Only allow requests from origins you explicitly list in .env —
// prevents random websites from calling your API using a logged-in
// user's browser session/cookies.
app.use(
  cors({
    origin: env.allowedOrigins,
    credentials: true,
  })
);

// Body size limit — stops someone sending a 500MB JSON body to
// exhaust memory (a cheap denial-of-service vector).
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Strips duplicate query params (a known HTTP Parameter Pollution
// technique used to bypass some validation logic).
app.use(hpp());

// Applies to every route below this line.
app.use(apiLimiter);

app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/delivery', deliveryRoutes);

app.use(notFoundHandler);
app.use(errorHandler); // must be last

module.exports = app;
