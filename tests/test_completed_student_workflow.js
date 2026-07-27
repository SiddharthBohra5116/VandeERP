const assert = require('assert');
const fs = require('fs');

const directory = fs.readFileSync('controllers/admin/userDirectoryController.js', 'utf8');
const profile = fs.readFileSync('controllers/admin/studentManagementController.js', 'utf8');
const view = fs.readFileSync('views/admin/users.ejs', 'utf8');

assert.match(directory, /student\.statusHistory\.push/);
assert.match(directory, /nextStatus === 'complete'[\s\S]*\/admin\/students\?status=complete&updated=1/);
assert.match(profile, /USER_STATUSES\.includes\(nextStatus\)/);
assert.match(profile, /nextStatus === 'complete'[\s\S]*\/admin\/students\?status=complete&updated=1/);
assert.match(view, /Mark course completed/);
assert.match(view, /Student moved to Completed Students/);

console.log('Completed student workflow checks passed.');
