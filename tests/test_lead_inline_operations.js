const assert = require('assert');
const fs = require('fs');

const controller = fs.readFileSync('controllers/admin/leadController.js', 'utf8');
const routes = fs.readFileSync('routes/admin.js', 'utf8');
const list = fs.readFileSync('views/admin/leads.ejs', 'utf8');
const detail = fs.readFileSync('views/admin/lead-detail.ejs', 'utf8');

assert.match(routes, /\/leads\/:id\/status/);
assert.match(routes, /\/leads\/:id\/follow-up/);
assert.match(controller, /exports\.postUpdateLeadStatus/);
assert.match(controller, /exports\.postUpdateLeadFollowUp/);
assert.match(controller, /Use Admit as Student to complete admission/);
assert.match(list, /name="status"[\s\S]*onchange="this\.form\.submit\(\)"/);
assert.match(list, /type="date" name="followUpDate"/);
assert.match(detail, /class="lead-page-action-group"/);
assert.match(detail, /type="date" name="followUpDate"/);

console.log('Lead inline operation checks passed.');
