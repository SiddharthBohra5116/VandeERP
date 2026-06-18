const dashboardController = require('./admin/dashboardController');
const userDirectoryController = require('./admin/userDirectoryController');

const studentController = require('./admin/studentManagementController');
const teacherController = require('./admin/teacherManagementController');
const counsellorController = require('./admin/counsellorManagementController');

const profileRequestController = require('./admin/profileRequestController');
const messageController = require('./admin/messageController');
const passwordController = require('./admin/passwordController');
const certificateController = require('./admin/certificateController');

const feeController = require('./admin/feeController');
const attendanceController = require('./admin/attendanceController');
const leadController = require('./admin/leadController');
const scheduleController = require('./admin/scheduleController');
const holidayController = require('./admin/holidayController');
const reportController = require('./admin/reportController');
const batchController = require('./admin/batchController');
const announcementController = require('./admin/announcementController');

module.exports = {
  ...dashboardController,
  ...userDirectoryController,

  ...studentController,
  ...teacherController,
  ...counsellorController,

  ...profileRequestController,
  ...messageController,
  ...passwordController,
  ...certificateController,

  ...feeController,
  ...attendanceController,
  ...leadController,
  ...scheduleController,
  ...holidayController,
  ...reportController,
  ...batchController,
  ...announcementController
};