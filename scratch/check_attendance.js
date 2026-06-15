require('dotenv').config();
const mongoose = require('mongoose');
const Schedule = require('../models/Schedule');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vande_academy';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);

  const totalSchedules = await Schedule.countDocuments({});
  console.log('Total schedules in DB:', totalSchedules);

  const sample = await Schedule.find({}).populate('teacher').limit(2);
  console.log('Sample schedule teacher details:', JSON.stringify(sample, null, 2));

  await mongoose.connection.close();
}

check().catch(console.error);
