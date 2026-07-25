const assert = require('assert');
const fs = require('fs');
const { aliases } = require('../utils/googleSheetSync');

assert(aliases.id.includes('crm_lead_id'));
assert(aliases.phone.includes('mobile'));
assert(fs.readFileSync('routes/webhooks.js', 'utf8').includes("router.post('/google-sheets'"));
assert(fs.readFileSync('scripts/googleSheetsLeadSync.gs', 'utf8').includes('onEdit().create()'));

console.log('Google Sheets sync wiring passed.');
