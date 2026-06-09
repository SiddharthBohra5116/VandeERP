const { body, validationResult } = require('express-validator');

/**
 * High-order middleware to run validations and intercept validation errors,
 * redirecting back to the referer with a friendly error query parameter.
 */
const validate = (validations) => {
  return async (req, res, next) => {
    for (let validation of validations) {
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const firstError = errors.array()[0].msg;
    const redirectUrl = req.header('Referer') || '/';

    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(400).json({ error: firstError });
    }

    // Append error parameter to referer URL
    const cleanUrl = redirectUrl.split('?')[0];
    res.redirect(`${cleanUrl}?error=${encodeURIComponent(firstError)}`);
  };
};

const userValidator = validate([
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('A valid email address is required').normalizeEmail(),
  body('role').isIn(['admin', 'teacher', 'counsellor', 'student']).withMessage('A valid user role is required'),
  body('password').optional({ checkFalsy: true }).isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
]);

const paymentValidator = validate([
  body('amount').custom(val => {
    const num = Number(val);
    if (isNaN(num) || num <= 0) {
      throw new Error('Payment amount must be a positive number');
    }
    return true;
  }),
  body('method').isIn(['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other']).withMessage('A valid payment method is required')
]);

const leadValidator = validate([
  body('name').trim().notEmpty().withMessage('Lead name is required'),
  body('phone').trim().isLength({ min: 10, max: 15 }).withMessage('A valid phone number (10-15 digits) is required')
]);

const scheduleValidator = validate([
  body('subject').trim().notEmpty().withMessage('Subject name is required'),
  body('batch').trim().notEmpty().withMessage('Student batch assignment is required'),
  body('teacher').isMongoId().withMessage('A valid teacher ID is required'),
  body('classroom').isMongoId().withMessage('A valid classroom ID is required'),
  body('date').isDate().withMessage('A valid schedule date is required'),
  body('startTime').matches(/^((0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)|([0-1]?[0-9]|2[0-3]):[0-5][0-9])$/i).withMessage('Start time must be in HH:MM or HH:MM AM/PM format'),
  body('endTime').matches(/^((0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)|([0-1]?[0-9]|2[0-3]):[0-5][0-9])$/i).withMessage('End time must be in HH:MM or HH:MM AM/PM format')
]);

module.exports = {
  userValidator,
  paymentValidator,
  leadValidator,
  scheduleValidator
};
