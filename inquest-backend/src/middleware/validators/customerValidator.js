const { param, body } = require('express-validator');

const customerIdParamRules = [
  param('customerId')
    .exists({ checkFalsy: true }).withMessage('customerId is required')
    .bail()
    .isString().withMessage('customerId must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('customerId must be 1-50 characters')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('customerId contains invalid characters'),
];

const createCustomerRules = [
  body('id')
    .optional()
    .isString().withMessage('id must be a string')
    .bail()
    .trim()
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('id contains invalid characters'),
  body('name')
    .exists({ checkFalsy: true }).withMessage('name is required')
    .bail()
    .isString().withMessage('name must be a string')
    .bail()
    .trim()
    .isLength({ min: 2, max: 80 }).withMessage('name must be 2-80 characters'),
  body('email')
    .exists({ checkFalsy: true }).withMessage('email is required')
    .bail()
    .isEmail().withMessage('email must be valid')
    .bail()
    .normalizeEmail(),
  body('tier')
    .optional()
    .isString().withMessage('tier must be a string')
    .bail()
    .trim()
    .toLowerCase()
    .isIn(['silver', 'gold', 'platinum']).withMessage('tier must be silver, gold, or platinum'),
  body('joinedDate')
    .optional()
    .isISO8601().withMessage('joinedDate must be a valid date'),
  body('joinedOn')
    .optional()
    .isISO8601().withMessage('joinedOn must be a valid date'),
  body('orders')
    .optional()
    .isArray().withMessage('orders must be an array'),
  body('payments')
    .optional()
    .isArray().withMessage('payments must be an array'),
  body('tickets')
    .optional()
    .isArray().withMessage('tickets must be an array'),
];

module.exports = { customerIdParamRules, createCustomerRules };
