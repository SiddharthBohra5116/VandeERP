const assert = require('assert');
const fs = require('fs');
const { visibleToCounsellor } = require('../utils/leadOwnership');

assert.deepStrictEqual(visibleToCounsellor('mine'), {
  archivedAt: null,
  $or: [{ assignedTo: 'mine' }, { assignedTo: null }]
});

const routes = fs.readFileSync('routes/counsellor.js', 'utf8');
for (const action of ['convert', 'edit', 'followup', 'lost', 'ready']) {
  assert(routes.includes(`/${action}'`) && routes.includes('claimLead'));
}

console.log('Counsellor lead ownership rules passed.');
