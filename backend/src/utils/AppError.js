// Use this for every "expected" error (validation failed, not found,
// unauthorized, etc.) so the error handler knows it's safe to show
// the message to the client. Anything that is NOT an AppError is
// treated as an unexpected bug and gets a generic message instead —
// this stops stack traces / internal details leaking to users.
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
