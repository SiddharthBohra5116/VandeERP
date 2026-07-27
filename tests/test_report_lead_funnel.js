const assert = require('assert');
const fs = require('fs');

const controller = fs.readFileSync('controllers/admin/reportController.js', 'utf8');
const report = fs.readFileSync('views/admin/reports.ejs', 'utf8');

assert.match(controller, /status === 'admission_completed' \|\| Boolean\(lead\.convertedStudent\)/);
assert.match(controller, /Converted: convertedCount/);
assert.match(controller, /ConversionRate: cRate/);
assert.match(report, /<div class="stat-label">Converted<\/div>/);
assert.match(report, /<div class="stat-label">Conversion Rate<\/div>/);
assert.doesNotMatch(report, /funnel\.Enrolled/);

console.log('Lead funnel report checks passed.');
