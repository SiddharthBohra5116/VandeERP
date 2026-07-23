const express = require('express');
const router = express.Router();
// Multer dependency removed in favor of uploadHelper
const protect = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/teacherController');
const Message = require('../models/Message');
const upload = require('../utils/uploadHelper');
const csrfProtection = require('../middleware/security/csrfProtection');
const guard = [protect, role('teacher', 'admin')];

router.get('/dashboard', ...guard, ctrl.getDashboard);

// Attendance
router.get('/attendance', ...guard, ctrl.getAttendancePage);
router.post('/attendance', ...guard, ctrl.postMarkAttendance);
router.get('/attendance/history', ...guard, ctrl.getAttendanceHistory);

// Assignments
router.get('/assignments', ...guard, ctrl.getAssignments);
router.get('/assignments/create', ...guard, ctrl.getCreateAssignment);
router.post('/assignments/create', ...guard, upload.single('file'), csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
}, ctrl.postCreateAssignment);
router.get('/assignments/:id', ...guard, ctrl.getAssignmentDetail);
router.post('/assignments/:id/extend', ...guard, ctrl.postExtendDueDate);
router.post('/assignments/:id/bulk-grade', ...guard, ctrl.postBulkGradeSubmissions);
router.post('/assignments/:id/grade/:subId', ...guard, ctrl.postGradeSubmission);

// Daily updates
router.get('/updates', ...guard, ctrl.getDailyUpdates);
router.get('/updates/create', ...guard, ctrl.getCreateUpdate);
router.post('/updates/create', ...guard, upload.single('file'), csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
}, ctrl.postCreateUpdate);

// Curriculum
router.get('/curriculum', ...guard, ctrl.getCurriculum);
router.post('/curriculum', ...guard, ctrl.postCreateCurriculum);
router.get('/curriculum/:id', ...guard, ctrl.getCurriculumDetail);
router.post('/curriculum/:id/topics', ...guard, ctrl.postAddTopic);
router.post('/curriculum/:id/topics/:topicId/toggle', ...guard, ctrl.postToggleTopic);

// Progress
router.get('/progress', ...guard, ctrl.getProgress);
router.post('/progress/test', ...guard, ctrl.postAddTestResult);
router.post('/progress/bulk-test', ...guard, ctrl.postBulkAddTestResult);
router.post('/progress/delete-test', ...guard, ctrl.postDeleteTest);
router.post('/progress/:studentId/remark', ...guard, ctrl.postUpdateRemark);

// Students
router.get('/students', ...guard, ctrl.getMyStudents);
router.get('/students/:id/profile-summary', ...guard, ctrl.getStudentProfileSummary);

// Messaging
router.post('/messages/send', ...guard, ctrl.postSendMessage);
router.post('/messages/:id/read', ...guard, async (req, res) => {
  await Message.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ ok: true });
});

// Leave Requests
router.get('/leaves', ...guard, ctrl.getLeavesPage);
router.post('/leaves/apply', ...guard, ctrl.postApplyLeave);

// Complete Class Action
router.post('/schedules/:id/complete', ...guard, ctrl.postCompleteSchedule);

// Announcements
router.get('/announcements', ...guard, ctrl.getTeacherAnnouncements);
router.get('/announcements/create', ...guard, ctrl.getTeacherCreateAnnouncement);
router.post('/announcements/create', ...guard, upload.array('attachments', 5), csrfProtection, (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
}, ctrl.postTeacherCreateAnnouncement);
router.post('/announcements/:id/toggle', ...guard, ctrl.postTeacherToggleAnnouncement);

module.exports = router;
