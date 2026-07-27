const assert = require('assert');
const fs = require('fs');

const read = file => fs.readFileSync(file, 'utf8');
const checks = [
  ['views/admin/student-profile.ejs', ['feesEnabled', 'attendanceEnabled', 'teacherEnabled', 'counsellorEnabled', 'coursesEnabled', 'batchesEnabled', 'leadsEnabled', 'progressEnabled', 'kycEnabled']],
  ['controllers/admin/studentManagementController.js', ['feesEnabled', 'attendanceEnabled', 'teacherEnabled', 'counsellorEnabled', 'coursesEnabled', 'batchesEnabled', 'leadsEnabled']],
  ['controllers/admin/userDirectoryController.js', ['feesEnabled', 'attendanceEnabled', 'teachersEnabled', 'counsellorsEnabled', 'coursesEnabled', 'batchesEnabled', 'leadsEnabled']],
  ['views/counsellor/reports.ejs', ['leadsEnabled', 'studentsEnabled', 'batchesEnabled', 'attendanceEnabled', 'feesEnabled', 'assignmentsEnabled']],
  ['views/student/analytics.ejs', ['attendanceEnabled', 'assignmentsEnabled', 'progressEnabled', 'feesEnabled', 'curriculumEnabled', 'teachersEnabled']],
  ['views/auth/profile.ejs', ['coursesEnabled', 'batchesEnabled', 'feesEnabled', 'teachersEnabled', 'counsellorsEnabled']],
  ['views/counsellor/students.ejs', ['coursesEnabled', 'batchesEnabled', 'feesEnabled']],
  ['views/counsellor/admissions.ejs', ['coursesEnabled', 'batchesEnabled', 'feesEnabled']]
];

for (const [file, flags] of checks) {
  const source = read(file);
  for (const flag of flags) assert.ok(source.includes(flag), `${file} is missing ${flag}`);
}

assert.match(read('middleware/moduleSettings.js'), /students[\s\S]*profile-requests/);
assert.match(read('controllers/admin/userDirectoryController.js'), /render\('module-disabled'/);
assert.match(read('controllers/admin/dashboardController.js'), /modules\.fees !== false/);
assert.match(read('controllers/admin/reportController.js'), /attendanceEnabled = res\.locals\.modules\?\.attendance !== false/);
assert.match(read('controllers/authController.js'), /roleEnabled = role => role === 'admin'/);
assert.match(read('views/auth/inbox.ejs'), /modules\.teachers !== false/);

console.log(`Module leak audit passed across ${checks.length + 6} shared surfaces.`);
