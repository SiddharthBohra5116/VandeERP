const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const User = require('../models/User');

async function syncCourseCompletion(studentIds, changedBy) {
  const ids = [...new Set(studentIds.map(String))];
  if (!ids.length) return;
  const [students, counts] = await Promise.all([
    Student.find({ _id: { $in: ids } }).populate('course', 'requiredClasses').select('user course requiredClassesOverride statusHistory'),
    Attendance.aggregate([
      { $match: { student: { $in: ids.map(id => new (require('mongoose').Types.ObjectId)(id)) }, status: { $in: ['present', 'late'] } } },
      { $group: { _id: '$student', count: { $sum: 1 } } }
    ])
  ]);
  const byStudent = new Map(counts.map(item => [String(item._id), item.count]));
  for (const student of students) {
    const target = Number(student.requiredClassesOverride || student.course?.requiredClasses || 0);
    if (!target || (byStudent.get(String(student._id)) || 0) < target) continue;
    const user = await User.findById(student.user);
    if (!user || user.status === 'complete') continue;
    user.status = 'complete';
    student.statusHistory.push({ status: 'complete', changedBy, reason: `Automatically completed after attending ${target} required classes.` });
    await Promise.all([user.save(), student.save()]);
  }
}

module.exports = syncCourseCompletion;
