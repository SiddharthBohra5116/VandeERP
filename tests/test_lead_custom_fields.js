const assert = require('assert');
const fs = require('fs');

const view = fs.readFileSync('views/counsellor/lead-form.ejs', 'utf8');
const routes = fs.readFileSync('routes/admin.js', 'utf8');
const controller = fs.readFileSync('controllers/admin/leadController.js', 'utf8');

assert.match(view, /id="customFieldForm"[\s\S]*action="\/admin\/leads\/custom-fields"/);
assert.match(view, /id="newCustomFieldLabel" form="customFieldForm"/);
assert.match(view, /type="submit" form="customFieldForm"/);
assert.match(routes, /leads\/custom-fields'[\s\S]*csrfProtection[\s\S]*postCreateCustomField/);
assert.match(controller, /customFields: normalizeLeadCustomValues/);
console.log('Lead custom fields test passed');
