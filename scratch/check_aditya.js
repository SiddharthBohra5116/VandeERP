const mongoose = require('mongoose');
const Student = require('../models/Student');
const User = require('../models/User');

async function check() {
  await mongoose.connect('mongodb://localhost:27017/vande_academy');
  const user = await User.findOne({ email: 'student63@demo.com' });
  console.log('User found:', user);
  if (user) {
    const student = await Student.findOne({ user: user._id });
    console.log('Student Profile found:', student);
  }
  await mongoose.disconnect();
}
check();
