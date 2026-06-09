const mongoose = require('mongoose');
const User = require('../models/User');
const Assignment = require('../models/Assignment');
const connectDB = require('../config/db');

async function run() {
  await connectDB();
  const assignments = await Assignment.find().populate('teacher', 'name');
  console.log('Assignments in database:');
  for (const a of assignments) {
    const activeCount = await User.countDocuments({ role: 'student', batch: a.batch, isActive: true });
    const totalCount = await User.countDocuments({ role: 'student', batch: a.batch });
    console.log(`- "${a.title}" (Batch: ${a.batch}) by ${a.teacher ? a.teacher.name : 'Unknown'}: ${activeCount} active students out of ${totalCount} total students. Submissions count: ${a.submissions.length}`);
  }
  await mongoose.disconnect();
}
run();
