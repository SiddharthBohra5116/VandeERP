const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const routes = read('routes/admin.js');
const controller = read('controllers/admin/leadController.js');
const list = read('views/admin/leads.ejs');
const detail = read('views/admin/lead-detail.ejs');

assert.match(routes, /router\.get\('\/leads\/:id\/edit'.*leadCtrl\.getEditLead/s);
assert.match(routes, /router\.post\('\/leads\/:id\/edit'.*leadCtrl\.postEditLead/s);
assert.match(controller, /exports\.getEditLead\s*=/);
assert.match(controller, /exports\.postEditLead\s*=/);
assert.match(list, /href="\/admin\/leads\/<%= l\._id %>\/edit"/);
assert.match(detail, /href="\/admin\/leads\/<%= lead\._id %>\/edit"/);

console.log('Admin lead edit wiring checks passed.');
