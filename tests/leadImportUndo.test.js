const assert = require('assert');
const fs = require('fs');
const ejs = require('ejs');
const Lead = require('../models/Lead');

const controller = fs.readFileSync('controllers/admin/leadController.js', 'utf8');
const routes = fs.readFileSync('routes/admin.js', 'utf8');

assert(Lead.schema.path('importBatchId'));
assert(Lead.schema.path('importFileName'));
assert(controller.includes('const importBatchId = crypto.randomUUID()'));
assert(controller.includes('importBatchId,'));
assert(controller.includes("lead.status !== 'admission_completed'"));
assert(routes.includes("'/leads/import/:batchId/undo'"));
assert(controller.includes('postUndoLegacyLeadImport'));
assert(routes.includes("'/leads/import-history/undo'"));
assert(controller.includes("title: 'Lead imported from CSV', note"));
ejs.compile(fs.readFileSync('views/admin/leads.ejs', 'utf8'), { filename: 'views/admin/leads.ejs' });

console.log('Lead import undo wiring OK');
