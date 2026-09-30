const express = require('express');
const internalController = require('../controllers/internalController');
const requireInternalApiKey = require('../middlewares/internalAuth');

const router = express.Router();
router.use(requireInternalApiKey);

router.get('/customers/:userId/context', internalController.getCustomerContext);
router.get('/users/:userId/auth-status', internalController.getAuthStatus);

module.exports = router;
