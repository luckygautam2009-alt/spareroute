const AppError = require('../utils/AppError');

// Usage: router.post('/register', validate(schemas.register), controller)
// Validates req.body against a zod schema BEFORE it ever reaches your
// controller/SQL. This is the main defense against malformed/malicious
// input (oversized strings, wrong types, injection attempts, XSS payloads).
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const dataToValidate = source === 'params' ? req.params : source === 'query' ? req.query : req.body;
    const result = schema.safeParse(dataToValidate);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return next(new AppError(`Invalid input: ${message}`, 400));
    }
    if (source === 'params') {
      req.params = result.data;
    } else if (source === 'query') {
      req.query = result.data;
    } else {
      req.body = result.data; // use the parsed/sanitized version
    }
    next();
  };
}

module.exports = validate;
