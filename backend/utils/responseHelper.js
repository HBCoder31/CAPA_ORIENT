/**
 * Standardized API Response Helper
 */

/**
 * Send a success response.
 * @param {Object} res - Express response object
 * @param {any} data - Data to send back to the client
 * @param {string} message - Message summarizing the action
 * @param {number} statusCode - HTTP status code (default: 200)
 */
function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send an error response.
 * @param {Object} res - Express response object
 * @param {string} message - Error description
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {any} errorDetails - Additional error details (useful for validation errors)
 */
function sendError(res, message = 'Internal Server Error', statusCode = 500, errorDetails = null) {
  const responseBody = {
    success: false,
    message,
    data: null,
  };

  if (errorDetails !== null) {
    responseBody.errorDetails = errorDetails;
  }

  return res.status(statusCode).json(responseBody);
}

module.exports = {
  sendSuccess,
  sendError,
};
