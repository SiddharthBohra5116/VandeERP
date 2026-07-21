'use strict';
const assert = require('assert');

const validRole = role => ['teacher', 'counsellor'].includes(role);
assert.equal(validRole('teacher'), true);
assert.equal(validRole('counsellor'), true);
assert.equal(validRole('admin'), false);
assert.equal(/^\d{10}$/.test('9876543210'), true);
assert.equal(/^\d{10}$/.test('1234'), false);
console.log('temporary staff boundary checks passed');
