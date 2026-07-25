const fs = require('fs');
const assert = require('assert');

const view = fs.readFileSync('views/admin/leads.ejs', 'utf8');
const routes = fs.readFileSync('routes/admin.js', 'utf8');
const controller = fs.readFileSync('controllers/admin/leadController.js', 'utf8');

assert(view.includes('id="bulkAssignForm"'));
assert(view.includes("fetch(select.form.action"));
assert(!view.includes('class="lead-select-badge" onchange="this.form.submit()"'));
assert(routes.includes("router.post('/leads/assign'"));
assert(controller.includes('exports.postAssignLeads = async'));

console.log('Admin lead assignment UI wiring passed.');
