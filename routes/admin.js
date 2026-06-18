const express = require('express');
const router = express.Router();

const protect = require('../middleware/auth');
const role = require('../middleware/role');
const upload = require('../utils/uploadHelper');

// ================================
// Split Admin Controllers
// ================================

const dashboardCtrl = require('../controllers/admin/dashboardController');

const userDirectoryCtrl = require('../controllers/admin/userDirectoryController');

const studentCtrl = require('../controllers/admin/studentManagementController');
const teacherCtrl = require('../controllers/admin/teacherManagementController');
const counsellorCtrl = require('../controllers/admin/counsellorManagementController');

const profileRequestCtrl = require('../controllers/admin/profileRequestController');
const messageCtrl = require('../controllers/admin/messageController');
const passwordCtrl = require('../controllers/admin/passwordController');
const certificateCtrl = require('../controllers/admin/certificateController');

// Existing Domain Controllers
const feeCtrl = require('../controllers/admin/feeController');
const leadCtrl = require('../controllers/admin/leadController');
const scheduleCtrl = require('../controllers/admin/scheduleController');
const reportCtrl = require('../controllers/admin/reportController');
const attendanceCtrl = require('../controllers/admin/attendanceController');
const holidayCtrl = require('../controllers/admin/holidayController');
const batchCtrl = require('../controllers/admin/batchController');
const announcementCtrl = require('../controllers/admin/announcementController');

// Validators
const {
  userValidator,
  paymentValidator,
  scheduleValidator
} = require('../middleware/validators');

const guard = [protect, role('admin')];


// ===================================
// DASHBOARD
// ===================================

router.get('/dashboard', ...guard, dashboardCtrl.getDashboard);


// ===================================
// PROFILE REQUESTS
// ===================================

router.get(
  '/profile-requests',
  ...guard,
  profileRequestCtrl.getProfileRequests
);


// ===================================
// USER DIRECTORY
// ===================================

router.get('/users', ...guard, userDirectoryCtrl.getUsers);

router.get('/students', ...guard, studentCtrl.getStudents);
router.get('/teachers', ...guard, teacherCtrl.getTeachers);
router.get('/counsellors', ...guard, counsellorCtrl.getCounsellors);


// ===================================
// USER CRUD
// ===================================

router.get(
  '/users/create',
  ...guard,
  userDirectoryCtrl.getCreateUser
);

router.post(
  '/users/create',
  ...guard,
  upload.single('profilePic'),
  userValidator,
  userDirectoryCtrl.postCreateUser
);

router.get(
  '/users/:id/edit',
  ...guard,
  userDirectoryCtrl.getEditUser
);

router.post(
  '/users/:id/edit',
  ...guard,
  upload.single('profilePic'),
  userValidator,
  userDirectoryCtrl.postEditUser
);

router.post(
  '/users/:id/toggle',
  ...guard,
  userDirectoryCtrl.toggleUserStatus
);


// ===================================
// PASSWORD ACTIONS
// ===================================

router.post(
  '/users/:id/reset-password',
  ...guard,
  passwordCtrl.resetPassword
);

router.post(
  '/users/:id/dismiss-reset',
  ...guard,
  passwordCtrl.dismissResetRequest
);


// ===================================
// BATCH MANAGEMENT
// ===================================

router.get('/batches', ...guard, batchCtrl.getBatches);

router.get(
  '/batches/create',
  ...guard,
  batchCtrl.getCreateBatch
);

router.post(
  '/batches/create',
  ...guard,
  batchCtrl.postCreateBatch
);

router.get(
  '/batches/:id/edit',
  ...guard,
  batchCtrl.getEditBatch
);

router.post(
  '/batches/:id/edit',
  ...guard,
  batchCtrl.postEditBatch
);

router.post(
  '/batches/:id/delete',
  ...guard,
  batchCtrl.postDeleteBatch
);


// ===================================
// STUDENT MANAGEMENT
// ===================================

router.get(
  '/students/:id',
  ...guard,
  studentCtrl.getStudentProfile
);

router.post(
  '/students/:id/verify-id',
  ...guard,
  studentCtrl.postVerifyStudentId
);

router.post(
  '/students/:id/remark',
  ...guard,
  studentCtrl.postAddStudentRemark
);

router.post(
  '/students/:id/status',
  ...guard,
  studentCtrl.postUpdateStudentStatus
);

router.post(
  '/students/:id/approve-profile',
  ...guard,
  profileRequestCtrl.postApproveProfileUpdate
);

router.post(
  '/students/:id/reject-profile',
  ...guard,
  profileRequestCtrl.postRejectProfileUpdate
);


// ===================================
// TEACHER MANAGEMENT
// ===================================

router.get(
  '/teachers/:id',
  ...guard,
  teacherCtrl.getTeacherProfile
);


// ===================================
// COUNSELLOR MANAGEMENT
// ===================================

router.get(
  '/counsellors/:id',
  ...guard,
  counsellorCtrl.getCounsellorProfile
);


// ===================================
// MESSAGES
// ===================================

router.post(
  '/messages/read-all',
  ...guard,
  messageCtrl.markAllMessagesRead
);

router.post(
  '/messages/:id/read',
  ...guard,
  messageCtrl.markMessageRead
);

router.post(
  '/messages/send',
  ...guard,
  upload.array('attachments', 5),
  messageCtrl.postSendMessage
);

// ===================================
// FEES
// ===================================

router.get('/fees', ...guard, feeCtrl.getFees);

router.get(
  '/fees/:studentId',
  ...guard,
  feeCtrl.getStudentFee
);

router.post(
  '/fees/:studentId/payment',
  ...guard,
  paymentValidator,
  feeCtrl.postAddPayment
);

router.post(
  '/fees/:studentId/update',
  ...guard,
  feeCtrl.postUpdateFee
);


// ===================================
// LEADS
// ===================================

router.get('/leads', ...guard, leadCtrl.getLeads);

router.get(
  '/leads/:id',
  ...guard,
  leadCtrl.getLeadDetail
);

router.post(
  '/leads/:id/assign',
  ...guard,
  leadCtrl.postAssignLead
);

router.get(
  '/leads/:id/convert',
  ...guard,
  leadCtrl.getConvertLead
);

router.post(
  '/leads/:id/convert',
  ...guard,
  leadCtrl.postConvertLead
);

router.post(
  '/leads/:id/comment',
  ...guard,
  leadCtrl.postAddLeadComment
);


// ===================================
// ATTENDANCE
// ===================================

router.get(
  '/attendance',
  ...guard,
  attendanceCtrl.getAttendanceOverview
);


// ===================================
// SCHEDULES
// ===================================

router.get(
  '/schedules',
  ...guard,
  scheduleCtrl.getSchedules
);

router.get(
  '/schedules/create',
  ...guard,
  scheduleCtrl.getCreateSchedule
);

router.post(
  '/schedules/create',
  ...guard,
  scheduleValidator,
  scheduleCtrl.postCreateSchedule
);

router.get(
  '/schedules/:id/edit',
  ...guard,
  scheduleCtrl.getEditSchedule
);

router.post(
  '/schedules/:id/edit',
  ...guard,
  scheduleValidator,
  scheduleCtrl.postEditSchedule
);

router.post(
  '/schedules/:id/delete',
  ...guard,
  scheduleCtrl.postDeleteSchedule
);


// ===================================
// TIMETABLES
// ===================================

router.post(
  '/timetables',
  ...guard,
  scheduleCtrl.postSaveTimetable
);

router.post(
  '/timetables/:id/delete',
  ...guard,
  scheduleCtrl.postDeleteTimetable
);


// ===================================
// CLASSROOMS
// ===================================

router.post(
  '/classrooms/create',
  ...guard,
  scheduleCtrl.postCreateClassroom
);

router.post(
  '/classrooms/:id/edit',
  ...guard,
  scheduleCtrl.postEditClassroom
);

router.post(
  '/classrooms/:id/delete',
  ...guard,
  scheduleCtrl.postDeleteClassroom
);


// ===================================
// REPORTS
// ===================================

router.get('/reports', ...guard, reportCtrl.getReports);

router.post(
  '/reports/financial/target',
  ...guard,
  reportCtrl.postSetRevenueTarget
);

router.post(
  '/reports/financial/expense',
  ...guard,
  reportCtrl.postAddExpense
);

router.post(
  '/reports/financial/expense/:id/delete',
  ...guard,
  reportCtrl.postDeleteExpense
);


// ===================================
// HOLIDAYS & LEAVES
// ===================================

router.get(
  '/holidays-leaves',
  ...guard,
  holidayCtrl.getHolidaysLeaves
);

router.post(
  '/holidays/create',
  ...guard,
  holidayCtrl.postAddHoliday
);

router.post(
  '/holidays/:id/delete',
  ...guard,
  holidayCtrl.postDeleteHoliday
);

router.post(
  '/leaves/:id/approve',
  ...guard,
  holidayCtrl.postApproveLeave
);

router.post(
  '/leaves/:id/reject',
  ...guard,
  holidayCtrl.postRejectLeave
);


// ===================================
// CERTIFICATES
// ===================================

router.get(
  '/students/:id/certificate',
  ...guard,
  certificateCtrl.getStudentCertificate
);


// ===================================
// ANNOUNCEMENTS
// ===================================

router.get(
  '/announcements',
  ...guard,
  announcementCtrl.getAnnouncements
);

router.get(
  '/announcements/create',
  ...guard,
  announcementCtrl.getCreateAnnouncement
);

router.post(
  '/announcements/create',
  ...guard,
  announcementCtrl.postCreateAnnouncement
);

router.post(
  '/announcements/:id/toggle',
  ...guard,
  announcementCtrl.postToggleAnnouncement
);


module.exports = router;