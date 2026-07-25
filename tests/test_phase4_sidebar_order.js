const assert = require('assert');
const fs = require('fs');

const sidebar = fs.readFileSync('views/partials/sidebar.ejs', 'utf8');

assert.match(sidebar, /sidebar-order:/);
assert.match(sidebar, /option\.draggable = true/);
assert.match(sidebar, /addEventListener\('drop'/);
assert.match(sidebar, /localStorage\.setItem\(orderKey/);
assert.match(sidebar, /item\.closest\('\.nav-flyout'\) \|\| item/);
assert.match(sidebar, /setAttribute\('aria-label'/);

console.log('Phase 4 sidebar ordering checks passed.');
