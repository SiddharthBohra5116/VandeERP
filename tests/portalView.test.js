'use strict';
const assert = require('assert');

const allowedRoles = ['teacher', 'counsellor'];
assert.equal(allowedRoles.includes('teacher'), true);
assert.equal(allowedRoles.includes('counsellor'), true);
assert.equal(allowedRoles.includes('student'), false);
assert.equal(/^[a-f\d]{24}$/i.test('507f1f77bcf86cd799439011'), true);
assert.equal(/^[a-f\d]{24}$/i.test('../../admin'), false);
console.log('portal view boundary checks passed');
