const assert = require('assert');
const fs = require('fs');

const model = fs.readFileSync('models/Lead.js', 'utf8');
const form = fs.readFileSync('views/counsellor/lead-form.ejs', 'utf8');
const detail = fs.readFileSync('views/counsellor/lead-detail.ejs', 'utf8');
const admin = fs.readFileSync('controllers/admin/leadController.js', 'utf8');
const counsellor = fs.readFileSync('controllers/counsellor/leadController.js', 'utf8');
const students = fs.readFileSync('controllers/admin/studentManagementController.js', 'utf8');
const studentDirectory = fs.readFileSync('views/admin/users.ejs', 'utf8');
const leadDirectory = fs.readFileSync('views/admin/leads.ejs', 'utf8');
const counsellorDirectory = fs.readFileSync('views/counsellor/leads.ejs', 'utf8');
const counsellorRoutes = fs.readFileSync('routes/counsellor.js', 'utf8');
const userModel = fs.readFileSync('models/User.js', 'utf8');
const userForm = fs.readFileSync('views/admin/user-form.ejs', 'utf8');
const userDirectory = fs.readFileSync('controllers/admin/userDirectoryController.js', 'utf8');

assert(model.includes('defaultSimCode'));
assert(form.includes('name="defaultSimCode"'));
assert(detail.includes('value="<%= lead.defaultSimCode ||'));
assert(admin.includes('lead.defaultSimCode ='));
assert(counsellor.includes("defaultSimCode: String(defaultSimCode || '').trim().toUpperCase().slice(0, 50)"));
assert(model.includes('simCode:'));
assert(students.includes('defaultSimCode: plainUser.defaultSimCode || lead?.defaultSimCode'));
assert(studentDirectory.includes('data-column="simCode"'));
assert(leadDirectory.includes('data-lead-column="simCode"'));
assert(counsellorDirectory.includes('data-lead-column="simCode"'));
assert(counsellorDirectory.includes('/sim-code'));
assert(counsellorRoutes.includes("router.post('/leads/:id/sim-code'"));
assert(counsellor.includes('exports.postUpdateSimCode'));
assert(form.includes('placeholder="e.g., A7 or G2"'));
assert(userModel.includes('defaultSimCode'));
assert(userForm.includes('name="defaultSimCode"'));
assert(userDirectory.includes("defaultSimCode: String(data.defaultSimCode || '').trim().toUpperCase().slice(0, 50)"));
assert(userDirectory.includes('exports.setUserSimCode'));
assert(studentDirectory.includes('/sim-code'));

console.log('Phase 2 SIM code wiring passed.');
