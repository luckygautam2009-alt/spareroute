const express = require('express');
const deliveryController = require('../controllers/deliveryController');
const validate = require('../middlewares/validate');
const schemas = require('../schemas/deliverySchemas');
const requireAuth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');

const router = express.Router();
router.use(requireAuth, requireRole('delivery_partner'));
router.get('/available', deliveryController.listAvailable);
router.get('/my', deliveryController.myDeliveries);
router.patch('/:orderId/claim', deliveryController.claimOrder);
router.patch('/:orderId/status', validate(schemas.updateDeliveryStatus), deliveryController.updateStatus);

module.exports = router;
