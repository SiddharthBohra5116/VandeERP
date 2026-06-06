const express = require('express');
const router = express.Router();
// Multer dependency removed in favor of uploadHelper
const path = require('path');
const protect = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const upload = require('../utils/uploadHelper');

const rateLimit = require('express-rate-limit');
const isTest = process.env.NODE_ENV === 'test' || (process.env.PORT && process.env.PORT.startsWith('31'));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many password reset attempts from this IP, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

router.get('/login', ctrl.getLogin);
router.post('/login', loginLimiter, ctrl.postLogin);
router.get('/forgot-password', ctrl.getForgotPassword);
router.post('/forgot-password', forgotPasswordLimiter, ctrl.postForgotPassword);
router.get('/logout', ctrl.logout);

router.get('/profile', protect, ctrl.getProfile);
router.post('/profile', protect, upload.single('profilePic'), ctrl.updateProfile);
router.post('/change-password', protect, ctrl.changePassword);

// Messaging Inbox
router.get('/inbox', protect, ctrl.getInbox);
router.post('/inbox/send', protect, ctrl.postInboxSend);

// Notifications
router.post('/notifications/:id/read', protect, ctrl.postReadNotification);
router.post('/notifications/read-all', protect, ctrl.postReadAllNotifications);

// Interactive Visual Platform Guide
router.get('/guide', protect, ctrl.getGuide);

module.exports = router;
