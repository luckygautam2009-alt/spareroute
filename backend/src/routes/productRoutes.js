const express = require('express');
const productController = require('../controllers/productController');
const validate = require('../middlewares/validate');
const schemas = require('../schemas/productSchemas');
const requireAuth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');

const router = express.Router();

// Public search — no auth required, buyers browse before logging in.
router.get('/search', productController.search);

// Seller-only writes
router.post('/', requireAuth, requireRole('seller'), validate(schemas.create), productController.create);
router.patch(
  '/:productId/stock',
  requireAuth,
  requireRole('seller'),
  validate(schemas.updateStock),
  productController.updateStock
);

module.exports = router;
