const { validationResult } = require('express-validator');

/**
 * Runs after express-validator checks. If any validation failed,
 * responds with 400 and a clean list of field-level errors.
 * Never leaks stack traces or internal details.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { validate };
