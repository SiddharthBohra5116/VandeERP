const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'controllers', 'admin', 'scheduleController.js');
let content = fs.readFileSync(filepath, 'utf8');

// Replace notifyBatchStudents
const oldNotify = `async function notifyBatchStudents({ adminId, batchId, teacherId, content }) {
  const students = await Student.find({ batch: batchId })
    .populate('userId', '_id status');

  const notifications = [];

  if (teacherId) {
    notifications.push(Message.create({
      sender: adminId,
      recipient: teacherId,
      content
    }));
  }

  students.forEach(student => {
    if (student.userId && student.userId.status === 'active') {
      notifications.push(Message.create({
        sender: adminId,
        recipient: student.userId._id,
        content
      }));
    }
  });

  await Promise.all(notifications);
}`;

const newNotify = `async function notifyBatchStudents({ adminId, batchId, teacherId, content }) {
  const students = await Student.find({ batch: batchId })
    .populate('user', '_id status');

  const notifications = [];

  if (teacherId) {
    const Teacher = require('../../models/Teacher');
    const teacherProfile = await Teacher.findById(teacherId).select('user');
    if (teacherProfile && teacherProfile.user) {
      notifications.push(Message.create({
        sender: adminId,
        recipient: teacherProfile.user,
        content
      }));
    }
  }

  students.forEach(student => {
    if (student.user && student.user.status === 'active') {
      notifications.push(Message.create({
        sender: adminId,
        recipient: student.user._id,
        content
      }));
    }
  });

  await Promise.all(notifications);
}`;

content = content.replace(oldNotify, newNotify);

// Replace User.find({ role: 'teacher' ... }) to fetch Teacher profiles
const oldTeacherFind = `      User.find({
        role: 'teacher',
        status: 'active'
      }).sort({ name: 1 })`;

const newTeacherFind = `      require('../../models/Teacher').find().populate({
        path: 'user',
        match: { status: 'active' }
      }).then(profiles => profiles.filter(p => p.user).map(p => ({
        _id: p._id,
        name: p.user.name,
        email: p.user.email
      })).sort((a, b) => a.name.localeCompare(b.name)))`;

content = content.replace(new RegExp(oldTeacherFind.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), newTeacherFind);

// Replace populate('teacher', 'name') and slots.teacher
content = content.replace(/\.populate\('teacher',\s*'name'\)/g, ".populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })");
content = content.replace(/\.populate\('slots\.teacher',\s*'name'\)/g, ".populate({ path: 'slots.teacher', populate: { path: 'user', select: 'name' } })");

fs.writeFileSync(filepath, content, 'utf8');
console.log('Schedule controller updated.');
