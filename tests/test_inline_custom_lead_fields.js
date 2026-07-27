const assert = require('assert');
const fs = require('fs');

const form = fs.readFileSync('views/counsellor/lead-form.ejs', 'utf8');
const controller = fs.readFileSync('controllers/admin/leadController.js', 'utf8');

assert.match(form, /user\?\.role === 'admin'/);
assert.match(form, /formaction="\/admin\/leads\/custom-fields"/);
assert.match(form, /name="returnTo" value="\/admin\/leads\/create"/);
assert.match(controller, /req\.body\.returnTo === '\/admin\/leads\/create'/);

console.log('Inline custom lead field checks passed.');
