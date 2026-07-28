const assert = require('assert');
const fs = require('fs');

const sidebar = fs.readFileSync('views/partials/sidebar.ejs', 'utf8');
assert.match(sidebar, /toggle\.addEventListener\('click',[\s\S]*input\.checked = !input\.checked;[\s\S]*updateCounts\(\)/);
assert.match(sidebar, /input\[type="checkbox"\]:not\(:checked\)/);

console.log('Sidebar toggle checks passed.');
