const express = require('express');
const mechanicController = require('../controllers/mechanicController');
const validate = require('../middlewares/validate');
const schemas = require('../schemas/mechanicSchemas');
const requireAuth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');

const router = express.Router();

router.get('/seller/:sellerId', mechanicController.listForSeller);
router.post('/', requireAuth, requireRole('seller'), validate(schemas.create), mechanicController.create);
router.get('/my', requireAuth, requireRole('seller'), mechanicController.myMechanics);
router.patch('/:mechanicId', requireAuth, requireRole('seller'), validate(schemas.update), mechanicController.update);

module.exports = router;
