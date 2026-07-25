const assert = require('assert');
const fs = require('fs');

const sidebar = fs.readFileSync('views/partials/sidebar.ejs', 'utf8');
for (const status of ['high_potential', 'new', 'in_the_loop', 'admission_completed']) {
  assert(sidebar.includes(`/admin/leads?status=${status}`));
}
assert(sidebar.includes('.nav-flyout:focus-within'));

console.log('Lead pipeline flyout wiring passed.');
