const express = require('express');
const router = express.Router();
// Multer dependency removed in favor of uploadHelper
const protect = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/studentController');
const Message = require('../models/Message');

const upload = require('../utils/uploadHelper');
const guard = [protect, role('student', 'admin')];

router.get('/dashboard', ...guard, ctrl.getDashboard);
router.get('/assignments', ...guard, ctrl.getAssignments);
router.post('/assignments/:id/submit', ...guard, upload.single('file'), ctrl.postSubmitAssignment);
router.get('/attendance', ...guard, ctrl.getAttendance);
router.get('/updates', ...guard, ctrl.getDailyUpdates);
router.get('/progress', ...guard, ctrl.getProgress);
router.get('/curriculum', ...guard, ctrl.getCurriculum);
router.get('/fees', ...guard, ctrl.getFees);
router.get('/analytics', ...guard, ctrl.getAnalytics);

// Profile & Feedback Upgrades
router.post('/profile/upload-id', ...guard, upload.single('idProof'), ctrl.postUploadIdProof);
router.post('/feedback', ...guard, ctrl.postSubmitFeedback);
router.get('/certificate', ...guard, ctrl.getCertificate);

// Messaging
router.post('/messages/send', ...guard, ctrl.postSendMessage);
router.post('/messages/:id/read', ...guard, async (req, res) => {
  await Message.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ ok: true });
});
module.exports = router;