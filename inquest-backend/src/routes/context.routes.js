const express = require('express');
const router = express.Router();
const { getCustomerContext } = require('../controllers/context.controller');
const { listCustomers, createCustomer } = require('../controllers/customer.controller');
const { customerIdParamRules } = require('../middleware/validators/customerValidator');
const { newCustomerValidationRules } = require('../middleware/validators/newCustomerValidator');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');

// Legacy admin-only routes: they expose customer data, so never public.
router.use(requireAuth, requireRole('admin'));

router.get('/', listCustomers);
router.post('/', newCustomerValidationRules, validate, createCustomer);
router.get('/:customerId/context', customerIdParamRules, validate, getCustomerContext);

module.exports = router;
