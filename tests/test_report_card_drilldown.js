const assert = require('assert');
const fs = require('fs');

const report = fs.readFileSync('views/admin/reports.ejs', 'utf8');
const leads = fs.readFileSync('controllers/admin/leadController.js', 'utf8');
const fees = fs.readFileSync('controllers/admin/feeController.js', 'utf8');
const reports = fs.readFileSync('controllers/admin/reportController.js', 'utf8');
const students = fs.readFileSync('controllers/admin/studentManagementController.js', 'utf8');

assert.doesNotMatch(report, /<div class="stat-card/);
assert.match(report, /a\.stat-card::after/);
assert.match(report, /\/admin\/students\?status=active/);
assert.match(report, /\/admin\/fees\?aging=91_plus/);
assert.match(report, /\/admin\/leads\?age=stale/);
assert.match(leads, /pipeline === 'open'/);
assert.match(leads, /dateField === 'converted'/);
assert.match(fees, /\['current', '1_30', '31_60', '61_90', '91_plus'\]\.includes\(aging\)/);
assert.match(reports, /overviewFees\.reduce\([\s\S]*totalAmount - \(fee\.discount \|\| 0\) - fee\.paidAmount/);
assert.match(reports, /\.filter\(row => monthInPeriod\(row\.month\)\)/);
assert.match(reports, /s\.user\.role === 'student'[\s\S]*s\.user\.status === 'active'[\s\S]*s\.user\.isActive !== false[\s\S]*!s\.user\.archivedAt/);
assert.match(students, /status === 'active'\) userFilter\.isActive = \{ \$ne: false \}/);
assert.match(reports, /const overviewFees = fees\.filter\(fee => activeStudentIds\.has\(String\(fee\.student\)\)\)/);
assert.match(report, /Collected in period/);
assert.match(report, /Current outstanding/);
assert.match(report, /All time/);
assert.match(report, /Last 30 days/);
assert.match(report, /Custom range/);
assert.match(reports, /datePreset === 'all'/);
assert.match(reports, /datePreset === 'last30'/);

console.log('Report card drill-down checks passed.');
