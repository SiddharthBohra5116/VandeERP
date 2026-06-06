/**
 * controllers/teacherController.js
 *
 * Facade that re-exports every teacher controller function.
 * routes/teacher.js imports this as:
 *   const ctrl = require('../controllers/teacherController');
 * Update that import to:
 *   const ctrl = require('../controllers/teacher');
 * All exported names are identical — no route changes required.
 */

const dashboardController     = require('./teacher/dashboardController');
const attendanceController    = require('./teacher/attendanceController');
const assignmentController    = require('./teacher/assignmentController');
const contentController       = require('./teacher/contentController');
const progressController      = require('./teacher/progressController');
const communicationController = require('./teacher/communicationController');

module.exports = {
  ...dashboardController,      // getDashboard
  ...attendanceController,     // getAttendancePage, postMarkAttendance, getAttendanceHistory
  ...assignmentController,     // getAssignments, getCreateAssignment, postCreateAssignment, getAssignmentDetail, postGradeSubmission
  ...contentController,        // getDailyUpdates, getCreateUpdate, postCreateUpdate, getCurriculum, postCreateCurriculum, getCurriculumDetail, postAddTopic, postToggleTopic
  ...progressController,       // getProgress, postAddTestResult, postUpdateRemark, getMyStudents
  ...communicationController,  // postSendMessage, getLeavesPage, postApplyLeave, postCompleteSchedule
};