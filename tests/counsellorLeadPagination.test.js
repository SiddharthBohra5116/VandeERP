const assert = require('assert');
const fs = require('fs');
const ejs = require('ejs');

const controller = fs.readFileSync('controllers/admin/counsellorManagementController.js', 'utf8');
assert(controller.includes('const limit = 25'));
assert(controller.includes('.skip((page - 1) * limit)'));
assert(controller.includes('Lead.countDocuments(leadFilter)'));
assert(controller.includes('phoneSearchPattern(search)'));
ejs.compile(fs.readFileSync('views/admin/counsellor-profile.ejs', 'utf8'), { filename: 'views/admin/counsellor-profile.ejs' });

console.log('Counsellor lead pagination wiring OK');
