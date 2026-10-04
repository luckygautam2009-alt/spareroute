const express = require('express');
const orderController = require('../controllers/orderController');
const validate = require('../middlewares/validate');
const schemas = require('../schemas/orderSchemas');
const requireAuth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');

const router = express.Router();
router.use(requireAuth);

router.post('/', requireRole('buyer'), validate(schemas.create), orderController.create);
router.get('/my', requireRole('buyer'), orderController.myOrders);
router.patch('/:orderId/status', requireRole('seller'), validate(schemas.orderIdParam, 'params'), validate(schemas.updateStatus), orderController.updateStatus);
router.patch('/:orderId/rate-mechanic', requireRole('buyer'), validate(schemas.orderIdParam, 'params'), validate(schemas.rateMechanic), orderController.rateMechanic);
router.post('/:orderId/cancel', requireRole('buyer'), validate(schemas.orderIdParam, 'params'), validate(schemas.cancel), orderController.cancelOrder);
router.post('/:orderId/return', requireRole('buyer'), validate(schemas.orderIdParam, 'params'), validate(schemas.createReturn), orderController.requestReturn);

module.exports = router;
