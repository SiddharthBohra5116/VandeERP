const dashboardController = require('./counsellor/dashboardController');
const leadController = require('./counsellor/leadController');
const admissionController = require('./counsellor/admissionController');
const leaveController = require('./counsellor/leaveController');
const reportController = require('./counsellor/reportController');

module.exports = {
  ...dashboardController,
  ...leadController,
  ...admissionController,
  ...leaveController,
  ...reportController
};