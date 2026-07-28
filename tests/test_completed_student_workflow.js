const assert = require('assert');
const fs = require('fs');

const directory = fs.readFileSync('controllers/admin/userDirectoryController.js', 'utf8');
const profile = fs.readFileSync('controllers/admin/studentManagementController.js', 'utf8');
const view = fs.readFileSync('views/admin/users.ejs', 'utf8');

assert.match(directory, /student\.statusHistory\.push/);
assert.match(directory, /nextStatus === 'complete'[\s\S]*\/admin\/students\?status=complete&updated=1/);
assert.match(profile, /USER_STATUSES\.includes\(nextStatus\)/);
assert.match(profile, /nextStatus === 'complete'[\s\S]*\/admin\/students\?status=complete&updated=1/);
assert.match(view, /name="status"[\s\S]*Course completed/);
assert.match(view, /Student moved to Completed Students/);
assert.match(view, /onchange="this\.form\.requestSubmit\(\)"/);
assert.doesNotMatch(view, />Apply filters</);
assert.match(view, /formaction="\/admin\/users\/bulk-complete"/);
assert.match(directory, /exports\.bulkCompleteUsers/);
assert.match(directory, /Course marked completed in bulk/);

console.log('Completed student workflow checks passed.');
