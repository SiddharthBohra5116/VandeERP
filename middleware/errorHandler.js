const logger = require('../utils/logger');

/**
 * Express error-handling middleware. Logs the error as a structured JSON object
 * and returns the appropriate rendered view or JSON response.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.status || 500;
  
  logger.error(err.message || 'Server Error', {
    status: statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user ? req.user._id : undefined,
    role: req.user ? req.user.role : undefined
  });

  // Make sure csrfToken local variable exists for view rendering
  res.locals.csrfToken = res.locals.csrfToken || '';

  if (req.xhr || req.headers.accept?.includes('json')) {
    return res.status(statusCode).json({
      error: err.message || 'An unexpected error occurred'
    });
  }

  res.status(statusCode).render('500', {
    title: statusCode === 404 ? 'Page Not Found' : 'Server Error',
    layout: 'main',
    errorDetail: err.message || 'An unexpected error occurred'
  });
}

module.exports = errorHandler;
