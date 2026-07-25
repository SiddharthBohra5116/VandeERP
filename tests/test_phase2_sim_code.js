const assert = require('assert');
const fs = require('fs');

const model = fs.readFileSync('models/Lead.js', 'utf8');
const form = fs.readFileSync('views/counsellor/lead-form.ejs', 'utf8');
const detail = fs.readFileSync('views/counsellor/lead-detail.ejs', 'utf8');
const admin = fs.readFileSync('controllers/admin/leadController.js', 'utf8');
const counsellor = fs.readFileSync('controllers/counsellor/leadController.js', 'utf8');

assert(model.includes('defaultSimCode'));
assert(form.includes('name="defaultSimCode"'));
assert(detail.includes('value="<%= lead.defaultSimCode ||'));
assert(admin.includes('lead.defaultSimCode ='));
assert(counsellor.includes("defaultSimCode: String(defaultSimCode || '').trim().slice(0, 50)"));
assert(model.includes('simCode:'));

console.log('Phase 2 SIM code wiring passed.');
