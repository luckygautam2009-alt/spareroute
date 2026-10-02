const express = require('express');
const router = express.Router();
const { submitComplaint } = require('../controllers/complaint.controller');
const { complaintValidationRules } = require('../middleware/validators/complaintValidator');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { userComplaintsLimiter } = require('../middleware/rateLimiter');

router.post('/', requireAuth, requireRole('buyer'), userComplaintsLimiter, complaintValidationRules, validate, submitComplaint);

module.exports = router;
