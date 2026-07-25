const assert = require('assert');
const fs = require('fs');

const view = fs.readFileSync('views/admin/users.ejs', 'utf8');

assert.match(view, /\.people-table \{ width:100%; min-width:100%/);
assert.doesNotMatch(view, /\.people-table \{ width:max-content/);
assert.match(view, /data-column-preset="essential"/);
assert.match(view, /data-column-preset="all"/);
assert.match(view, /const locked = new Set\(\['name', 'actions'\]\)/);
assert.match(view, /id="columnSearch"/);
assert.match(view, /visibleColumnCount/);

console.log('Phase 5 people column checks passed.');
