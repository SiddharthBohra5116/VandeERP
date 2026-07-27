const assert = require('assert');
const fs = require('fs');

const view = fs.readFileSync('views/admin/user-form.ejs', 'utf8');
const controller = fs.readFileSync('controllers/admin/userDirectoryController.js', 'utf8');

assert.match(view, /isStudentSetup[\s\S]*Set Up Student Profile/);
assert.match(view, /Create Student Profile/);
assert.match(controller, /savedStudent = await Student\.findOneAndUpdate/);
assert.match(controller, /\/admin\/students\/\$\{savedStudent\._id\}\?updated=1/);
console.log('Student profile setup test passed');
