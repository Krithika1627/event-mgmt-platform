const logger = require('../utils/logger');

function errorMiddleware(err, req, res, _next) {
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'MALFORMED_JSON', message: 'Request body contains invalid JSON.' }
    });
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred.';

  if (statusCode === 500) {
    logger.error('Unhandled error:', err);
  }

  const payload = {
    success: false,
    error: { code, message }
  };

  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    payload.error.message = 'An unexpected error occurred.';
  }

  res.status(statusCode).json(payload);
}

module.exports = errorMiddleware;
