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
    role: req.user ? req.user.role : undefined,
    writeCommitted: !!err.writeCommitted
  });

  // Make sure csrfToken local variable exists for view rendering
  res.locals.csrfToken = res.locals.csrfToken || '';

  if (err.writeCommitted) {
    // The core DB write already succeeded before this error fired — a side effect
    // (notification, denormalized sync, audit log) failed afterward. We must never
    // tell the admin the operation failed when it didn't. Redirect to success state
    // with a non-blocking warning instead of the 500 page.
    const successPath = req.originalUrl.split('?')[0];
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(200).json({ success: true, warning: 'Saved, but a follow-up step failed.' });
    }
    return res.redirect(`${successPath}?updated=1&warning=followup_failed`);
  }

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
