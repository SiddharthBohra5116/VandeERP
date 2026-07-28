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
assert.match(view, /@media \(max-width:760px\)[\s\S]*\.people-table \[data-column="actions"\] \{ position:static; width:180px; min-width:180px; \}/);
assert.doesNotMatch(view, /\.people-table thead \{ display:none; \}/);
assert.match(view, /\.people-bulk-main, \.people-bulk-actions \{ display:grid !important; grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
assert.match(view, /u\.studentProfile \? `\/admin\/students\/\$\{u\.studentProfile\._id\}` : `\/admin\/students\/account\/\$\{u\._id\}`/);

console.log('Phase 5 people column checks passed.');
