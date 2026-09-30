const { body } = require('express-validator');

const complaintValidationRules = [
  body('complaintText')
    .exists({ checkFalsy: true }).withMessage('complaintText is required')
    .bail()
    .isString().withMessage('complaintText must be a string')
    .bail()
    .trim()
    .isLength({ min: 5, max: 2000 }).withMessage('complaintText must be 5-2000 characters'),
];

module.exports = { complaintValidationRules };
