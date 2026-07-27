const assert = require('assert');
const fs = require('fs');

const read = file => fs.readFileSync(file, 'utf8');
const { DEFAULTS, routeRules } = require('../middleware/moduleSettings');

for (const key of [
  'students', 'teachers', 'counsellors', 'courses', 'batches', 'attendance', 'kyc',
  'leads', 'fees', 'schedules', 'assignments', 'updates', 'curriculum', 'progress',
  'announcements', 'reports', 'leaves'
]) {
  assert.strictEqual(DEFAULTS[key], true, `${key} must be independently configurable`);
}

for (const path of [
  '/admin/leads', '/admin/fees', '/admin/schedules', '/admin/reports',
  '/teacher/assignments', '/teacher/updates', '/teacher/curriculum',
  '/student/fees', '/student/analytics', '/counsellor/leaves'
]) {
  assert(routeRules.some(([, pattern]) => pattern.test(path)), `${path} needs module route protection`);
}

assert.match(read('models/Schedule.js'), /teacher:[\s\S]*?default: null/);
assert.match(read('models/Timetable.js'), /teacher:[\s\S]*?default: null/);
assert.match(read('utils/clashDetector.js'), /teacherId && sched\.teacher/);

for (const file of [
  'views/admin/batch-form.ejs',
  'views/admin/schedule-form.ejs',
  'views/admin/schedules.ejs',
  'views/admin/convert.ejs',
  'views/counsellor/convert.ejs'
]) {
  assert.match(read(file), /modules\?\.teachers !== false/, `${file} must make teacher assignment optional`);
}

assert.match(read('views/admin/user-form.ejs'), /if \(moduleFlags\.teachers\)/);
assert.match(read('controllers/admin/scheduleController.js'), /modules\?\.teachers === false \? null/);
assert.match(read('controllers/admin/batchController.js'), /modules\?\.teachers !== false && teachers/);
assert.match(read('controllers/admin/batchController.js'), /modules\?\.teachers === false\) teachersArray = batch\.teachers/);
assert.match(read('controllers/admin/leadController.js'), /modules\?\.teachers !== false && req\.body\.teacherId/);
assert.match(read('controllers/counsellor/admissionController.js'), /modules\?\.teachers !== false && req\.body\.teacherId/);
assert.match(read('controllers/admin/leadController.js'), /feesEnabled = res\.locals\.modules\?\.fees !== false/);
assert.match(read('controllers/counsellor/admissionController.js'), /feesEnabled = res\.locals\.modules\?\.fees !== false/);
assert.match(read('controllers/student/dashboardController.js'), /modules\.batches !== false && !studentProfile\.batch/);
assert.match(read('controllers/student/dashboardController.js'), /modules\.attendance === false \? \[\]/);
assert.match(read('controllers/admin/reportController.js'), /requestedTab === 'attendance' && \(!attendanceEnabled \|\| !studentsEnabled\)/);
assert.match(read('controllers/admin/reportController.js'), /teacherEnabled \? await User\.find\(\{ role: 'teacher'/);
assert.match(read('controllers/admin/reportController.js'), /teacherEnabled \? User\.find\(\{ role: 'teacher'/);
assert.match(read('views/admin/reports.ejs'), /tab === 'attendance' && attendanceEnabled/);
assert.match(read('views/admin/reports.ejs'), /if \(attendanceEnabled\).*overviewAttendanceChart/s);
assert.match(read('views/admin/reports.ejs'), /if \(teacherEnabled\).*staff-teachers-section/s);

const reportsView = read('views/admin/reports.ejs');
for (const flag of [
  'studentsEnabled', 'feesEnabled', 'leadsEnabled', 'batchesEnabled', 'coursesEnabled',
  'attendanceEnabled', 'teacherEnabled', 'counsellorEnabled', 'assignmentsEnabled',
  'progressEnabled', 'schedulesEnabled', 'curriculumEnabled'
]) {
  assert.match(reportsView, new RegExp(`const ${flag} =`), `Reports must expose ${flag}`);
}
const studentDashboard = read('views/student/dashboard.ejs');
for (const moduleName of ['attendance', 'assignments', 'fees', 'kyc', 'schedules', 'updates']) {
  assert.match(studentDashboard, new RegExp(`modules\\?\\.${moduleName} !== false`), `Student dashboard must respect ${moduleName}`);
}
const teacherDashboard = read('views/teacher/dashboard.ejs');
for (const moduleName of ['students', 'attendance', 'assignments', 'schedules', 'updates', 'announcements']) {
  assert.match(teacherDashboard, new RegExp(`modules\\?\\.${moduleName} !== false`), `Teacher dashboard must respect ${moduleName}`);
}
assert.match(read('controllers/teacher/dashboardController.js'), /modules\.schedules === false \? \[\]/);
assert.match(read('controllers/counsellor/dashboardController.js'), /const leadsEnabled = modules\.leads !== false/);
assert.match(read('views/counsellor/dashboard.ejs'), /modules\?\.leads !== false/);

console.log('Module dependency checks passed.');
