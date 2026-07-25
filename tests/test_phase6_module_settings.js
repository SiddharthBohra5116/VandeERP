const assert = require('assert');
const fs = require('fs');
const { normalizeModules, routeRules } = require('../middleware/moduleSettings');

assert.deepStrictEqual(normalizeModules({ students: 'on', attendance: true }), {
  students: true,
  teachers: false,
  batches: false,
  attendance: true,
  kyc: false
});

const blockedBy = path => routeRules.find(([, pattern]) => pattern.test(path))?.[0];
assert.strictEqual(blockedBy('/admin/students'), 'students');
assert.strictEqual(blockedBy('/student/attendance'), 'students');
assert.strictEqual(blockedBy('/teacher/attendance/history'), 'teachers');
assert.strictEqual(blockedBy('/admin/batches/abc/edit'), 'batches');
assert.strictEqual(blockedBy('/admin/attendance'), 'attendance');
assert.strictEqual(blockedBy('/admin/students/abc/verify-id'), 'students');
assert.ok(routeRules.find(([key]) => key === 'kyc')[1].test('/admin/students/abc/verify-id'));

const sidebar = fs.readFileSync('views/partials/sidebar.ejs', 'utf8');
assert.match(sidebar, /modules\?\.students !== false/);
assert.match(sidebar, /modules\?\.teachers !== false/);
assert.match(sidebar, /modules\?\.attendance !== false/);
assert.match(sidebar, /href="\/admin\/modules"/);

const academic = fs.readFileSync('controllers/student/academicController.js', 'utf8');
const assignments = fs.readFileSync('controllers/student/assignmentController.js', 'utf8');
const directory = fs.readFileSync('controllers/admin/userDirectoryController.js', 'utf8');
assert.match(academic, /modules\?\.kyc !== false && isKycIncomplete/);
assert.match(assignments, /modules\?\.kyc !== false && isKycIncomplete/);
assert.match(directory, /modules\?\.batches === false \? null : await getCourseRoster/);

console.log('Phase 6 module settings checks passed.');
