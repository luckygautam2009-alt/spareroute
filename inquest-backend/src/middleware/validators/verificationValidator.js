const { body } = require('express-validator');

const verifyValidationRules = [
  body('employeeName')
    .exists({ checkFalsy: true }).withMessage('employeeName is required')
    .bail()
    .isString().trim().isLength({ min: 2, max: 80 }).withMessage('employeeName must be 2-80 characters'),

  body('employeeEmail')
    .exists({ checkFalsy: true }).withMessage('employeeEmail is required')
    .bail()
    .isEmail().withMessage('employeeEmail must be valid')
    .normalizeEmail(),

  body('adminPassword')
    .exists({ checkFalsy: true }).withMessage('adminPassword is required'),
];

module.exports = { verifyValidationRules };
