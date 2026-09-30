const express = require('express');
const kycController = require('../controllers/kycController');
const validate = require('../middlewares/validate');
const schemas = require('../schemas/kycSchemas');
const requireAuth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');
const { authLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.use(requireAuth, requireRole('seller'));

router.post('/initiate', authLimiter, validate(schemas.initiate), kycController.initiate);
router.post('/confirm', authLimiter, validate(schemas.confirm), kycController.confirm);
router.get('/status', kycController.status);

module.exports = router;
