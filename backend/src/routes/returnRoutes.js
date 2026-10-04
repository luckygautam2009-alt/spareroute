const express = require('express');
const returnController = require('../controllers/returnController');
const validate = require('../middlewares/validate');
const schemas = require('../schemas/returnSchemas');
const requireAuth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');

const router = express.Router();
router.use(requireAuth);

router.get('/', returnController.listReturns);
router.patch('/:id/review', requireRole('seller'), validate(schemas.reviewReturn), returnController.reviewReturn);
router.patch('/:id/received', requireRole('seller'), returnController.markReceived);

module.exports = router;
