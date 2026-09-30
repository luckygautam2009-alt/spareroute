const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const schemas = require('../schemas/authSchemas');
const { authLimiter } = require('../middlewares/rateLimiters');
const requireAuth = require('../middlewares/auth');

const router = express.Router();

router.post('/register', authLimiter, validate(schemas.register), authController.register);
router.post('/login', authLimiter, validate(schemas.login), authController.login);
router.post('/refresh', authLimiter, validate(schemas.refresh), authController.refresh);
router.post('/logout', requireAuth, authController.logout);

module.exports = router;
