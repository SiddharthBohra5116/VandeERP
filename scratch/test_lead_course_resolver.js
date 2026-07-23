const assert = require('assert');
const Course = require('../models/Course');
const { resolveCourse } = require('../utils/leadAutomation');

(async () => {
  const originalFindById = Course.findById;
  const id = '6a5a2b04607769801051e26b';
  Course.findById = value => Promise.resolve({ _id: value });
  try {
    assert.strictEqual(String((await resolveCourse(id))._id), id);
    assert.strictEqual(await resolveCourse('Undecided'), null);
    console.log('lead course ID resolution passed');
  } finally {
    Course.findById = originalFindById;
  }
})();
