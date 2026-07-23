const express = require('express');
const router = express.Router();
// Multer dependency removed in favor of uploadHelper
const protect = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/studentController');
const Message = require('../models/Message');

const upload = require('../utils/uploadHelper');
const csrfProtection = require('../middleware/security/csrfProtection');
const guard = [protect, role('student', 'admin')];
const enrolled = (req, res, next) => {
  if (req.user.studentProfileId && req.user.course && req.user.batch) return next();
  res.redirect('/student/dashboard?enrollment_pending=1');
};

router.get('/dashboard', ...guard, ctrl.getDashboard);
router.get('/announcements', ...guard, enrolled, ctrl.getAnnouncements);
router.get('/assignments', ...guard, enrolled, ctrl.getAssignments);
router.post('/assignments/:id/submit', ...guard, enrolled, upload.single('file'), csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
}, ctrl.postSubmitAssignment);
router.get('/attendance', ...guard, enrolled, ctrl.getAttendance);
router.get('/updates', ...guard, enrolled, ctrl.getDailyUpdates);
router.get('/progress', ...guard, enrolled, ctrl.getProgress);
router.get('/curriculum', ...guard, enrolled, ctrl.getCurriculum);
router.get('/fees', ...guard, enrolled, ctrl.getFees);
router.get('/analytics', ...guard, enrolled, ctrl.getAnalytics);

// Profile & Feedback Upgrades
router.post('/profile/upload-id', ...guard, enrolled, upload.single('idProof'), csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
}, ctrl.postUploadIdProof);
router.post('/feedback', ...guard, enrolled, ctrl.postSubmitFeedback);
router.get('/certificate', ...guard, enrolled, ctrl.getCertificate);

// Messaging
router.post('/messages/send', ...guard, ctrl.postSendMessage);
router.post('/messages/:id/read', ...guard, async (req, res) => {
  await Message.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ ok: true });
});
module.exports = router;
