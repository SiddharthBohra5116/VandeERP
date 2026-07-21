const assert = require('assert');
const calculate = require('../utils/courseProgress');

const progress = calculate(
  { requiredClassesOverride: 4, course: { requiredClasses: 10 } },
  [{ status: 'present' }, { status: 'absent' }, { status: 'late' }],
  [{ date: '2026-07-22' }, { date: '2026-07-24' }]
);
assert.deepEqual(progress, { target: 4, attended: 2, remaining: 2, complete: false, estimatedCompletionDate: '2026-07-24', additionalSchedulesNeeded: 0 });
console.log('Course progress rules OK');
