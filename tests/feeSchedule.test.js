'use strict';
const assert = require('assert');
const buildFeeSchedule = require('../utils/feeSchedule');

const valid = buildFeeSchedule({
  instName: ['Down payment', 'EMI 2'],
  instAmount: ['5000', '5000'],
  instDueDate: ['2026-08-01', '2026-09-01']
}, 10000);
assert.equal(valid.length, 2);
assert.equal(valid.reduce((sum, item) => sum + item.amount, 0), 10000);
assert.throws(() => buildFeeSchedule({ instName: ['EMI'], instAmount: ['9000'], instDueDate: ['2026-08-01'] }, 10000));
assert.throws(() => buildFeeSchedule({ instName: ['A', 'B'], instAmount: ['5000', '5000'], instDueDate: ['2026-09-01', '2026-08-01'] }, 10000));
console.log('fee schedule checks passed');
