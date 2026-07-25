const assert = require('assert');
const { normalizeLeadCustomValues, slugifyFieldKey } = require('../utils/leadCustomFields');

const fields = [
  { key: 'budget', label: 'Budget', type: 'number', required: true, options: [] },
  { key: 'language', label: 'Language', type: 'select', required: false, options: ['Hindi', 'English'] },
  { key: 'verified', label: 'Verified', type: 'checkbox', required: false, options: [] }
];

assert.strictEqual(slugifyFieldKey(' Preferred Language '), 'preferred_language');
assert.deepStrictEqual(
  normalizeLeadCustomValues({ budget: '25000', language: 'Hindi', verified: 'true' }, fields, { retired: 'kept' }),
  { retired: 'kept', budget: 25000, language: 'Hindi', verified: true }
);
assert.throws(() => normalizeLeadCustomValues({ budget: '' }, fields), /Budget is required/);
assert.throws(() => normalizeLeadCustomValues({ budget: '1', language: 'French' }, fields), /invalid option/);
assert.throws(
  () => normalizeLeadCustomValues({ budget: '1', start: '2026-02-31' }, [...fields, { key: 'start', label: 'Start', type: 'date', options: [] }]),
  /valid date/
);

console.log('Phase 3 custom lead field checks passed.');
