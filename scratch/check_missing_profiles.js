const mongoose = require('mongoose');
const Student = require('../models/Student');
const User = require('../models/User');

async function check() {
  await mongoose.connect('mongodb://localhost:27017/vande_academy');
  const students = await User.find({ role: 'student' });
  console.log(`Checking ${students.length} student users...`);
  for (const u of students) {
    const s = await Student.findOne({ user: u._id });
    if (!s) {
      console.log(`MISSING PROFILE for: ID: ${u._id}, Name: ${u.name}, Email: ${u.email}`);
    }
  }
  await mongoose.disconnect();
}
check();
