'use strict';
const assert = require('assert');
const { ATTENDANCE_STATUSES } = require('../config/constants');
const { isValidDateString } = require('../utils/dateHelper');

assert.equal(ATTENDANCE_STATUSES.includes('present'), true);
assert.equal(ATTENDANCE_STATUSES.includes('absent'), true);
assert.equal(ATTENDANCE_STATUSES.includes('late'), true);
assert.equal(ATTENDANCE_STATUSES.includes('excused'), false);
assert.equal(isValidDateString('2026-07-21'), true);
assert.equal(isValidDateString('2026-02-30'), false);
assert.equal(isValidDateString('21-07-2026'), false);
console.log('admin attendance boundary checks passed');
