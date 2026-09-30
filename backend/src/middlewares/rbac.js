const AppError = require('../utils/AppError');

// Usage: router.post('/products', requireAuth, requireRole('seller'), ...)
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      // Deliberately generic message — don't reveal what roles exist
      // or which one was required.
      return next(new AppError('You do not have permission to do this', 403));
    }
    next();
  };
}

module.exports = requireRole;
