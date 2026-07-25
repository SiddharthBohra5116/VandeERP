const assert = require('assert');
const fs = require('fs');
const getFeeStatus = require('../utils/feeStatus');

const now = new Date('2026-07-25T12:00:00Z');
assert.strictEqual(getFeeStatus({ totalAmount: 100, discount: 10, paidAmount: 90 }, now).paymentStatus, 'completed');
assert.strictEqual(getFeeStatus({ totalAmount: 100, paidAmount: 50 }, now).paymentStatus, 'partially_paid');
assert.strictEqual(getFeeStatus({ totalAmount: 100, paidAmount: 0, dueDate: '2026-07-01' }, now).paymentStatus, 'overdue');
assert.strictEqual(getFeeStatus({ totalAmount: 100, paidAmount: 0, dueDate: '2026-08-01' }, now).paymentStatus, 'unpaid');

const dashboard = fs.readFileSync('views/admin/dashboard.ejs', 'utf8');
const counsellorDashboard = fs.readFileSync('views/counsellor/dashboard.ejs', 'utf8');
const sidebar = fs.readFileSync('views/partials/sidebar.ejs', 'utf8');
const reports = fs.readFileSync('controllers/admin/reportController.js', 'utf8');
const inbox = fs.readFileSync('controllers/authController.js', 'utf8');

for (const status of ['high_potential', 'new', 'in_the_loop', 'admission_completed']) {
  assert(dashboard.includes(`/admin/leads?status=${status}`));
  assert(counsellorDashboard.includes(`/counsellor/leads?status=${status}`) || status === 'admission_completed');
}
assert(dashboard.includes('/admin/leads/create'));
assert(sidebar.includes('Completed Students'));
assert(reports.includes('convertedInPeriod'));
assert(inbox.includes("status: 'active', archivedAt: null"));

console.log('Phase 1 workflow checks passed.');
