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
router.patch(
  '/:orderId/status',
  requireRole('seller'),
  validate(schemas.updateStatus),
  orderController.updateStatus
);

module.exports = router;
