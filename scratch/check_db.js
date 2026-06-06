const mongoose = require('mongoose');
const User = require('../models/User');
const Fee = require('../models/Fee');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/vande_academy');
  console.log('Connected to DB');
  const user = await User.findOne({ name: /Siddharth/i });
  console.log('User Siddharth:', user);
  if (user) {
    const fee = await Fee.findOne({ student: user._id });
    console.log('Fee record:', fee);
  }
  await mongoose.disconnect();
}
run();
