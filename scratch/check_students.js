const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/vande_academy');
  console.log('Connected to DB');
  const users = await User.find({ role: 'student' });
  console.log(`Found ${users.length} student users:`);
  users.forEach(u => {
    console.log(`User ID: ${u._id}, Name: "${u.name}", Phone: "${u.phone}", Email: "${u.email}", Status: "${u.status}"`);
  });

  const students = await Student.find().populate('userId');
  console.log(`Found ${students.length} Student profiles:`);
  students.forEach(s => {
    console.log(`Student ID: ${s._id}, Roll: ${s.rollNumber}, User ID: ${s.userId?._id}, User Name: "${s.userId?.name}"`);
  });

  await mongoose.disconnect();
}
run();
