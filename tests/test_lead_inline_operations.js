const assert = require('assert');
const fs = require('fs');

const controller = fs.readFileSync('controllers/admin/leadController.js', 'utf8');
const routes = fs.readFileSync('routes/admin.js', 'utf8');
const list = fs.readFileSync('views/admin/leads.ejs', 'utf8');
const detail = fs.readFileSync('views/admin/lead-detail.ejs', 'utf8');
const counsellorRoutes = fs.readFileSync('routes/counsellor.js', 'utf8');
const counsellorList = fs.readFileSync('views/counsellor/leads.ejs', 'utf8');

assert.match(routes, /\/leads\/:id\/status/);
assert.match(routes, /\/leads\/:id\/follow-up/);
assert.match(controller, /exports\.postUpdateLeadStatus/);
assert.match(controller, /exports\.postUpdateLeadFollowUp/);
assert.match(controller, /Use Admit as Student to complete admission/);
assert.match(list, /name="status"[\s\S]*onchange="this\.form\.submit\(\)"/);
assert.match(list, /type="date" name="followUpDate"/);
assert.match(detail, /class="lead-page-action-group"/);
assert.match(detail, /type="date" name="followUpDate"/);
assert.match(counsellorRoutes, /leads\/:id\/status[\s\S]*postUpdateLeadStatus/);
assert.match(counsellorRoutes, /leads\/:id\/follow-up[\s\S]*postUpdateLeadFollowUp/);
assert.match(counsellorList, /id="counsellorLeadTable"/);
assert.match(counsellorList, /vande\.counsellorLeadColumns\.v1/);
assert.match(counsellorList, /\/counsellor\/leads\/<%= lead\._id %>\/status/);
assert.match(counsellorList, /\/counsellor\/leads\/<%= lead\._id %>\/follow-up/);

console.log('Lead inline operation checks passed.');
