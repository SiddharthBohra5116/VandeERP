'use strict';
const assert = require('assert');

const valid = (total, discount, paid) => Number.isFinite(total) && total > 0 && discount >= 0 && discount <= total && paid >= 0 && paid <= total - discount;
assert.equal(valid(30000, 3000, 5000), true);
assert.equal(valid(30000, 31000, 0), false);
assert.equal(valid(30000, 0, 31000), false);
assert.equal(valid(0, 0, 0), false);
console.log('fee setup boundary checks passed');
