const express = require('express');
const router = express.Router();
const { upload, requireValidImageMagicBytes } = require('../config/upload');
const { requireAuth, requireRole } = require('../middleware/auth');
const { verifyValidationRules } = require('../middleware/validators/verificationValidator');
const { validate } = require('../middleware/validate');
const { uploadReference, referenceStatus, verify } = require('../controllers/verification.controller');
const { userVerifyLimiter } = require('../middleware/rateLimiter');

// Auth runs BEFORE the file upload middleware, so anonymous requests
// can never make the server accept or store a file.
router.get('/reference/status', requireAuth, requireRole('admin'), referenceStatus);
router.post('/reference', requireAuth, requireRole('admin'), userVerifyLimiter, upload.single('idCard'), requireValidImageMagicBytes, uploadReference);
router.post('/', requireAuth, requireRole('admin'), userVerifyLimiter, upload.single('idCard'), requireValidImageMagicBytes, verifyValidationRules, validate, verify);

module.exports = router;
