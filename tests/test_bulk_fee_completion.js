const assert = require('assert');
const fs = require('fs');

const controller = fs.readFileSync('controllers/admin/feeController.js', 'utf8');
const routes = fs.readFileSync('routes/admin.js', 'utf8');
const view = fs.readFileSync('views/admin/fees.ejs', 'utf8');

assert.match(routes, /fees\/bulk-complete[\s\S]*csrfProtection[\s\S]*postBulkComplete/);
assert.match(controller, /totalAmount - \(fee\.discount \|\| 0\) - fee\.paidAmount/);
assert.match(controller, /amount: due/);
assert.match(view, /name="feeIds"/);
assert.match(view, /Complete selected/);
assert.doesNotMatch(view, /<form id="bulkCompleteFees"[^>]*data-confirm=/);
assert.match(view, /id="completeSelectedFees" disabled data-confirm=/);
assert.match(view, /if \(!checks\.some\(check => check\.checked\)\) event\.preventDefault\(\)/);
console.log('Bulk fee completion test passed');
