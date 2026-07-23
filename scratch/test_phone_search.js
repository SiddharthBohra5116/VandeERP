const assert = require('assert');
const { phoneSearchPattern } = require('../utils/sanitize');

const formatted = '+91 70236-19452';
assert(new RegExp(phoneSearchPattern('7023619452')).test(formatted));
assert(new RegExp(phoneSearchPattern('+91 70236 19452')).test(formatted));
assert.strictEqual(phoneSearchPattern('Vikram'), 'Vikram');
console.log('formatted phone search passed');
