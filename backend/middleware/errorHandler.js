const { sendError } = require('../utils/responseHelper');

/**
 * Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  console.error('❌ Unhandled Exception:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Handle specific database errors, validation errors, etc.
  if (err.isJoi) {
    return sendError(res, 'Validation Error', 400, err.details);
  }

  // MySQL unique constraint violation
  if (err.code === 'ER_DUP_ENTRY') {
    return sendError(res, 'A record with this identifier already exists.', 409);
  }

  return sendError(
    res,
    message,
    statusCode,
    process.env.NODE_ENV === 'development' ? { stack: err.stack } : null
  );
}

module.exports = errorHandler;
