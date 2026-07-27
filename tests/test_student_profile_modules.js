const assert = require('assert');
const fs = require('fs');

const controller = fs.readFileSync('controllers/admin/studentManagementController.js', 'utf8');
const view = fs.readFileSync('views/admin/student-profile.ejs', 'utf8');

assert.match(controller, /if \(attendanceEnabled && studentProfiles\.length > 0\)/);
assert.match(view, /if \(attendanceEnabled\)[\s\S]*openTab\(event, 'attendance'\)/);
assert.match(view, /if \(attendanceEnabled\)[\s\S]*id="attendance"/);
assert.match(view, /isAttendanceLow = attendanceEnabled/);
assert.match(controller, /teacherEnabled[\s\S]*if \(teacherEnabled\) studentQuery/);
assert.match(view, /if \(teacherEnabled\)[\s\S]*Primary Instructor/);
console.log('Student profile module test passed');
