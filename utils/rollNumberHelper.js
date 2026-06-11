const mongoose = require('mongoose');
const Counter = require('../models/Counter');

/**
 * Generates a unique roll number for the given role and document.
 * Format: VD-{roleCode}-{courseCode}-{year}-{serial}
 * 
 * @param {Object} doc - Mongoose document
 * @param {String} roleName - 'student', 'teacher', or 'counsellor'
 * @param {String} roleCode - 'STU', 'TCH', or 'CNS'
 */
async function generateRollNumber(doc, roleName, roleCode) {
  if (doc.rollNumber) return;

  const year = new Date().getFullYear().toString().slice(-2);
  let courseCode = 'XX';

  if (roleName === 'student' && doc.course) {
    const Course = mongoose.model('Course');
    const courseDoc = await Course.findById(doc.course);
    if (courseDoc) {
      const name = courseDoc.name.toLowerCase();
      if (name.includes('video') && name.includes('marketing')) courseCode = 'BT';
      else if (name.includes('video')) courseCode = 'VE';
      else if (name.includes('marketing')) courseCode = 'DM';
      else if (courseDoc.code) courseCode = courseDoc.code.slice(0, 2).toUpperCase();
    }
  } else if (roleName === 'teacher' && doc.subjects && doc.subjects.length > 0) {
    const subjectsStr = doc.subjects.join(' ').toLowerCase();
    if (subjectsStr.includes('video') && subjectsStr.includes('marketing')) courseCode = 'BT';
    else if (subjectsStr.includes('video')) courseCode = 'VE';
    else if (subjectsStr.includes('marketing')) courseCode = 'DM';
  }

  const counterId = `rollNumber_${roleName}_${year}`;
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const serial = String(counter.seq).padStart(3, '0');
  doc.rollNumber = `VD-${roleCode}-${courseCode}-${year}-${serial}`;
}

module.exports = { generateRollNumber };
