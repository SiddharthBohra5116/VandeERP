/**
 * controllers/student/index.js
 *
 * Facade that re-exports every student controller function.
 * The route file (routes/student.js) imports this as:
 *   const ctrl = require('../controllers/studentController');
 * After the refactor, routes/student.js should be updated to:
 *   const ctrl = require('../controllers/student');
 * All exported names remain identical so no route changes are needed.
 */

const dashboardController  = require('./student/dashboardController');
const assignmentController = require('./student/assignmentController');
const attendanceController = require('./student/attendanceController');
const academicController   = require('./student/academicController');
const profileController    = require('./student/profileController');
const analyticsController  = require('./student/analyticsController');

module.exports = {
  ...dashboardController,   // getDashboard
  ...assignmentController,  // getAssignments, postSubmitAssignment
  ...attendanceController,  // getAttendance
  ...academicController,    // getDailyUpdates, getProgress, getCurriculum, getFees
  ...profileController,     // postSendMessage, postUploadIdProof, postSubmitFeedback, getCertificate
  ...analyticsController,   // getAnalytics
};