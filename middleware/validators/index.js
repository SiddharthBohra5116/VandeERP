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
  body('phone').optional({ checkFalsy: true }).trim().matches(/^\d{10}$/).withMessage('Phone number must be exactly 10 digits'),
  body('guardianPhone').optional({ checkFalsy: true }).trim().matches(/^\d{10}$/).withMessage('Guardian phone number must be exactly 10 digits'),
  body('dob').optional({ checkFalsy: true }).isISO8601().withMessage('Date of Birth must be a valid date').custom(value => {
    const dob = new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (dob > today) {
      throw new Error('Date of Birth cannot be in the future');
    }
    return true;
  }),
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
  body('phone').trim().matches(/^\d{10}$/).withMessage('Lead phone number must be exactly 10 digits'),
  body('referredBy').if(body('source').equals('Referral')).trim().notEmpty().withMessage('Referrer name is required')
]);

const batchValidator = validate([
  body('name').trim().notEmpty().withMessage('Batch name is required'),
  body('course').isMongoId().withMessage('A valid course is required'),
  body('capacity').custom(value => {
    const capacity = Number(value);
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Batch capacity must be at least 1');
    }
    return true;
  }),
  body('startDate').optional({ checkFalsy: true }).isISO8601().withMessage('Start date must be valid'),
  body('endDate').optional({ checkFalsy: true }).isISO8601().withMessage('End date must be valid'),
  body('endDate').custom((endDate, { req }) => {
    if (!req.body.startDate || !endDate) return true;
    if (new Date(req.body.startDate) > new Date(endDate)) {
      throw new Error('Batch start date must be before end date');
    }
    return true;
  })
]);

const scheduleValidator = validate([
  body('subject').optional({ checkFalsy: true }).trim(),
  body('note').optional({ checkFalsy: true }).trim(),
  body('batch').isMongoId().withMessage('A valid batch assignment is required'),
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
  batchValidator,
  scheduleValidator
};
