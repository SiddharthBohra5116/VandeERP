const assert = require('assert');
const { cleanImportedPhone, courseFromFileName, importedCourseCode, isImportedStudentStatus, normalizeCourseName, parseCsv } = require('../utils/csvParser');

const [lead] = parseCsv('NAME,Phone Number,SPECIALIZATION COURSE,Current Status\nSurendar,p:+919928052828,Performance Marketing + AI,high Potential');

assert.equal(lead.specialization_course, 'Performance Marketing + AI');
assert.equal(cleanImportedPhone(lead.phone_number), '+919928052828');
assert.equal(courseFromFileName('Academy leads  - Video Editing Course  (1) (1).csv'), 'Video Editing Course');
assert.equal(normalizeCourseName('Video Editing Course'), normalizeCourseName('Video Editing'));
assert.equal(importedCourseCode('AI Bootcamp'), 'AB');
assert.equal(importedCourseCode('Performance Marketing + AI'), 'PMA');
assert.equal(isImportedStudentStatus('Paid'), true);
assert.equal(isImportedStudentStatus('high Potential'), false);
console.log('CSV import compatibility OK');
