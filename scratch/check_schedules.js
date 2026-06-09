const mongoose = require('mongoose');
require('../models/Classroom');
require('../models/User');
const Schedule = require('../models/Schedule');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/vande_academy');
  console.log('Connected to DB');
  const count = await Schedule.countDocuments({ date: { $regex: '^2026-06' } });
  console.log('Schedules count in June 2026:', count);
  const samples = await Schedule.find({ date: { $regex: '^2026-06' } }).populate('classroom').limit(10);
  console.log('Samples:', JSON.stringify(samples, null, 2));
  await mongoose.disconnect();
}
run();
