// Wrap every async controller with this so a thrown error / rejected
// promise goes to Express's error handler instead of crashing the
// process or hanging the request.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
