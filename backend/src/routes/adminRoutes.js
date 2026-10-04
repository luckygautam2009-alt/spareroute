const express = require('express');
const adminController = require('../controllers/adminController');
const validate = require('../middlewares/validate');
const schemas = require('../schemas/adminSchemas');
const requireAuth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));
router.get('/sellers/pending', adminController.listPendingSellers);
router.patch('/sellers/:sellerId/approve', validate(schemas.approveSeller), adminController.approveSeller);
router.get('/refunds', adminController.listRefunds);
router.post('/refunds', validate(schemas.createRefund), adminController.createRefund);
router.patch('/refunds/:id/process', validate(schemas.processRefund), adminController.processRefund);

module.exports = router;
