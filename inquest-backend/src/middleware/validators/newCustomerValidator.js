const { body } = require('express-validator');

const newCustomerValidationRules = [
  body('id')
    .optional()
    .isString().withMessage('id must be a string')
    .trim()
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('id contains invalid characters'),

  body('name')
    .exists({ checkFalsy: true }).withMessage('name is required')
    .bail()
    .isString().withMessage('name must be a string')
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage('name must be 2-80 characters'),

  body('email')
    .exists({ checkFalsy: true }).withMessage('email is required')
    .bail()
    .isEmail().withMessage('email must be valid')
    .normalizeEmail(),

  body('tier')
    .optional()
    .isIn(['silver', 'gold', 'platinum']).withMessage('tier must be silver, gold, or platinum'),

  body('order')
    .optional()
    .isObject().withMessage('order must be an object'),

  body('orders')
    .optional()
    .isArray().withMessage('orders must be an array'),

  body('order.product')
    .optional()
    .isString().isLength({ min: 1, max: 100 }).withMessage('order.product must be 1-100 characters'),

  body('order.amount')
    .optional()
    .isFloat({ min: 0 }).withMessage('order.amount must be a valid number'),

  body('order.status')
    .optional()
    .isIn(['delivered', 'in_transit', 'cancelled', 'returned']).withMessage('order.status is invalid'),

  body('order.gatewayStatus')
    .optional()
    .isIn(['success', 'failed']).withMessage('order.gatewayStatus must be success or failed'),

  body('order.localStatus')
    .optional()
    .isIn(['success', 'failed']).withMessage('order.localStatus must be success or failed'),
];

module.exports = { newCustomerValidationRules };
