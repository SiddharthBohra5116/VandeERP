/**
 * Express wrapper middleware to catch exceptions in asynchronous controller handlers
 * and pass them gracefully to the next error middleware.
 *
 * @param {Function} fn - Asynchronous route handler
 * @returns {Function} Express middleware handler
 */
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    err.writeCommitted = res.locals.writeCommitted === true;
    next(err);
  });
};

module.exports = asyncHandler;
