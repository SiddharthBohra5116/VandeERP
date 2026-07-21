const express = require('express');
const router = express.Router();

const protect = require('../middleware/auth');
const role = require('../middleware/role');
const upload = require('../utils/uploadHelper');
const csrfProtection = require('../middleware/security/csrfProtection');

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
const courseCtrl = require('../controllers/admin/courseController');
const announcementCtrl = require('../controllers/admin/announcementController');
const bulkImportCtrl = require('../controllers/admin/bulkImportController');

// Validators
const {
  userValidator,
  paymentValidator,
  batchValidator,
  scheduleValidator
} = require('../middleware/validators');

const guard = [protect, role('admin')];
const csvUpload = (field, redirect) => (req, res, next) => upload.single(field)(req, res, err => {
  if (err) return res.redirect(`${redirect}?error=${encodeURIComponent(err.message)}`);
  next();
});


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
router.get('/users/bin', ...guard, userDirectoryCtrl.getRecycleBin);

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
  csrfProtection,
  (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  },
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
  csrfProtection,
  (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  },
  userValidator,
  userDirectoryCtrl.postEditUser
);

router.post(
  '/users/:id/toggle',
  ...guard,
  userDirectoryCtrl.toggleUserStatus
);

router.post(
  '/users/:id/status',
  ...guard,
  userDirectoryCtrl.setUserStatus
);

router.post('/users/temporary-staff', ...guard, userDirectoryCtrl.postCreateTemporaryStaff);

router.post(
  '/users/bulk-archive',
  ...guard,
  userDirectoryCtrl.bulkArchiveUsers
);

router.post(
  '/users/:id/restore',
  ...guard,
  userDirectoryCtrl.restoreUser
);

router.post('/leads/:id/restore', ...guard, userDirectoryCtrl.restoreLead);


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

router.get('/courses', ...guard, courseCtrl.getCourses);
router.post('/courses', ...guard, courseCtrl.postCreateCourse);
router.post('/courses/:id', ...guard, courseCtrl.postUpdateCourse);
router.post('/courses/:id/toggle', ...guard, courseCtrl.postToggleCourse);

router.get('/batches', ...guard, batchCtrl.getBatches);

router.get(
  '/batches/create',
  ...guard,
  batchCtrl.getCreateBatch
);

router.post(
  '/batches/create',
  ...guard,
  batchValidator,
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
  batchValidator,
  batchCtrl.postEditBatch
);

router.post(
  '/batches/:id/delete',
  ...guard,
  batchCtrl.postDeleteBatch
);

router.get(
  '/batches/:id/students',
  ...guard,
  batchCtrl.getBatchStudents
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
  '/students/bulk-verify-id',
  ...guard,
  studentCtrl.postBulkVerifyStudentIds
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
  csrfProtection,
  (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  },
  messageCtrl.postSendMessage
);

// ===================================
// FEES
// ===================================

router.get('/fees', ...guard, feeCtrl.getFees);
router.post('/fees/import', ...guard, csvUpload('feeCsv', '/admin/fees'), csrfProtection, bulkImportCtrl.postImportFees);

router.get(
  '/fees/:studentId',
  ...guard,
  feeCtrl.getStudentFee
);

router.post('/students/:id/class-target', ...guard, studentCtrl.postUpdateClassTarget);

router.post('/fees/:studentId/setup', ...guard, feeCtrl.postSetupFee);

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
router.get('/leads/import/progress/:jobId', ...guard, leadCtrl.getImportProgress);

router.post(
  '/leads/import',
  ...guard,
  (req, res, next) => {
    upload.single('leadCsv')(req, res, function (err) {
      if (err) {
        return res.redirect(`/admin/leads?error=${encodeURIComponent(err.message)}`);
      }
      next();
    });
  },
  csrfProtection,
  (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
  },
  leadCtrl.postImportLeads
);

router.post(
  '/leads/statuses',
  ...guard,
  leadCtrl.postCreateStatus
);

router.post(
  '/leads/statuses/:id/delete',
  ...guard,
  leadCtrl.postDeleteStatus
);

router.post(
  '/leads/delete',
  ...guard,
  leadCtrl.postDeleteLeads
);

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

router.post('/attendance', ...guard, attendanceCtrl.postAdminAttendance);
router.post('/attendance/import', ...guard, csvUpload('attendanceCsv', '/admin/attendance'), csrfProtection, bulkImportCtrl.postImportAttendance);


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
