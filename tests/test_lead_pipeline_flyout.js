const assert = require('assert');
const fs = require('fs');

const sidebar = fs.readFileSync('views/partials/sidebar.ejs', 'utf8');
assert(sidebar.includes("typeof leadStatuses !== 'undefined'"));
assert(sidebar.includes('sidebarLeadStatuses.forEach'));
assert(sidebar.includes('encodeURIComponent(status.key)'));
assert(sidebar.includes('.nav-flyout:focus-within'));
assert(sidebar.includes('overflow-y:auto'));

const feedback = fs.readFileSync('public/js/app-feedback.js', 'utf8');
assert(feedback.includes("trigger.matches('form') && !event.target.closest('button[type=\"submit\"], input[type=\"submit\"]')"));

const leads = fs.readFileSync('views/admin/leads.ejs', 'utf8');
assert.match(leads, /@media \(max-width:760px\)[\s\S]*\.lead-import-undo \{ grid-template-columns:1fr !important; \}/);
assert.match(leads, /#leadTable \[data-lead-column="actions"\] \{ position:static; \}/);

console.log('Lead pipeline flyout wiring passed.');
