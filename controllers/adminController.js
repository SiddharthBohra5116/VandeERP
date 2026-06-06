const userController = require('./admin/userController');
const feeController = require('./admin/feeController');
const attendanceController = require('./admin/attendenceController');
const leadController = require('./admin/leadController');
const scheduleController = require('./admin/scheduleController');
const holidayController = require('./admin/holidayController');
const reportController = require('./admin/reportController');

module.exports = {
  ...userController,
  ...feeController,
  ...attendanceController,
  ...leadController,
  ...scheduleController,
  ...holidayController,
  ...reportController
};