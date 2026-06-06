const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const role = require('../middleware/role');
const upload = require('../utils/uploadHelper');

// Import domain sub-controllers
const userCtrl = require('../controllers/admin/userController');
const feeCtrl = require('../controllers/admin/feeController');
const leadCtrl = require('../controllers/admin/leadController');
const scheduleCtrl = require('../controllers/admin/scheduleController');
const reportCtrl = require('../controllers/admin/reportController');
const attendanceCtrl = require('../controllers/admin/attendenceController');
const holidayCtrl = require('../controllers/admin/holidayController');

// Import input validators
const { userValidator, paymentValidator, scheduleValidator } = require('../middleware/validators');

const guard = [protect, role('admin')];

// Dashboard
router.get('/dashboard', ...guard, userCtrl.getDashboard);

// Users Directory
router.get('/users', ...guard, userCtrl.getUsers);
router.get('/students', ...guard, userCtrl.getStudents);
router.get('/teachers', ...guard, userCtrl.getTeachers);
router.get('/counsellors', ...guard, userCtrl.getCounsellors);

// User CRUD
router.get('/users/create', ...guard, userCtrl.getCreateUser);
router.post('/users/create', ...guard, upload.single('profilePic'), userValidator, userCtrl.postCreateUser);
router.get('/users/:id/edit', ...guard, userCtrl.getEditUser);
router.post('/users/:id/edit', ...guard, upload.single('profilePic'), userValidator, userCtrl.postEditUser);
router.post('/users/:id/toggle', ...guard, userCtrl.toggleUserStatus);
router.post('/users/:id/reset-password', ...guard, userCtrl.resetPassword);
router.post('/users/:id/dismiss-reset', ...guard, userCtrl.dismissResetRequest);

// Student Profile & Actions
router.get('/students/:id', ...guard, userCtrl.getStudentProfile);
router.post('/students/:id/verify-id', ...guard, userCtrl.postVerifyStudentId);
router.post('/students/:id/remark', ...guard, userCtrl.postAddStudentRemark);
router.post('/students/:id/status', ...guard, userCtrl.postUpdateStudentStatus);
router.post('/students/:id/approve-profile', ...guard, userCtrl.postApproveProfileUpdate);
router.post('/students/:id/reject-profile', ...guard, userCtrl.postRejectProfileUpdate);

// Staff profiles
router.get('/teachers/:id', ...guard, userCtrl.getTeacherProfile);
router.get('/counsellors/:id', ...guard, userCtrl.getCounsellorProfile);

// Inbox notifications
router.post('/messages/send', ...guard, userCtrl.postSendMessage);
router.post('/messages/:id/read', ...guard, userCtrl.markMessageRead);

// Fees Management
router.get('/fees', ...guard, feeCtrl.getFees);
router.get('/fees/:studentId', ...guard, feeCtrl.getStudentFee);
router.post('/fees/:studentId/payment', ...guard, paymentValidator, feeCtrl.postAddPayment);
router.post('/fees/:studentId/update', ...guard, feeCtrl.postUpdateFee);

// Leads Pipeline
router.get('/leads', ...guard, leadCtrl.getLeads);
router.get('/leads/:id', ...guard, leadCtrl.getLeadDetail);
router.post('/leads/:id/assign', ...guard, leadCtrl.postAssignLead);
router.get('/leads/:id/convert', ...guard, leadCtrl.getConvertLead);
router.post('/leads/:id/convert', ...guard, leadCtrl.postConvertLead);
router.post('/leads/:id/comment', ...guard, leadCtrl.postAddLeadComment);

// Attendance Summary
router.get('/attendance', ...guard, attendanceCtrl.getAttendanceOverview);

// Class Schedules
router.get('/schedules', ...guard, scheduleCtrl.getSchedules);
router.get('/schedules/create', ...guard, scheduleCtrl.getCreateSchedule);
router.post('/schedules/create', ...guard, scheduleValidator, scheduleCtrl.postCreateSchedule);
router.get('/schedules/:id/edit', ...guard, scheduleCtrl.getEditSchedule);
router.post('/schedules/:id/edit', ...guard, scheduleValidator, scheduleCtrl.postEditSchedule);
router.post('/schedules/:id/delete', ...guard, scheduleCtrl.postDeleteSchedule);

// Timetable Templates
router.post('/timetables', ...guard, scheduleCtrl.postSaveTimetable);
router.post('/timetables/:id/delete', ...guard, scheduleCtrl.postDeleteTimetable);

// Classrooms CRUD
router.post('/classrooms/create', ...guard, scheduleCtrl.postCreateClassroom);
router.post('/classrooms/:id/edit', ...guard, scheduleCtrl.postEditClassroom);
router.post('/classrooms/:id/delete', ...guard, scheduleCtrl.postDeleteClassroom);

// Reports & Analytics
router.get('/reports', ...guard, reportCtrl.getReports);

// Holidays & Leaves Management
router.get('/holidays-leaves', ...guard, holidayCtrl.getHolidaysLeaves);
router.post('/holidays/create', ...guard, holidayCtrl.postAddHoliday);
router.post('/holidays/:id/delete', ...guard, holidayCtrl.postDeleteHoliday);
router.post('/leaves/:id/approve', ...guard, holidayCtrl.postApproveLeave);
router.post('/leaves/:id/reject', ...guard, holidayCtrl.postRejectLeave);

// Certificates
router.get('/students/:id/certificate', ...guard, userCtrl.getStudentCertificate);

module.exports = router;