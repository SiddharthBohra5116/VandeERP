const assert = require('assert');
const fs = require('fs');

const sidebar = fs.readFileSync('views/partials/sidebar.ejs', 'utf8');
assert(sidebar.includes("typeof leadStatuses !== 'undefined'"));
assert(sidebar.includes('sidebarLeadStatuses.forEach'));
assert(sidebar.includes('encodeURIComponent(status.key)'));
assert(sidebar.includes('/admin/leads#lead-pipeline-customization'));
assert(sidebar.includes('Customize Pipeline'));
assert(sidebar.includes('.nav-flyout:focus-within'));
assert(sidebar.includes('overflow-y:auto'));
assert(sidebar.includes("item.querySelector('svg')"));
assert(sidebar.includes('sidebarIcon.cloneNode(true)'));
assert(!sidebar.includes('small.textContent = path'));
assert(sidebar.includes('.sbc-option input[type="checkbox"]'));
assert(!sidebar.includes('.sbc-option input{position:absolute'));

const feedback = fs.readFileSync('public/js/app-feedback.js', 'utf8');
assert(feedback.includes("trigger.matches('form') && !event.target.closest('button[type=\"submit\"], input[type=\"submit\"]')"));

const leads = fs.readFileSync('views/admin/leads.ejs', 'utf8');
assert.match(leads, /@media \(max-width:760px\)[\s\S]*\.lead-import-undo \{ grid-template-columns:1fr !important; \}/);
assert.match(leads, /#leadTable \[data-lead-column="actions"\] \{ position:static; \}/);
assert(leads.includes('id="lead-pipeline-customization"'));
assert(!leads.includes('id="statusIsClosed"'));
assert(leads.includes('id="statusPreviewLabel">Selected status'));

const controller = fs.readFileSync('controllers/admin/leadController.js', 'utf8');
assert(controller.includes('if (status.isSystem)'));
assert(controller.includes('Move+leads+out+of+this+status+before+deleting+it'));

console.log('Lead pipeline flyout wiring passed.');
