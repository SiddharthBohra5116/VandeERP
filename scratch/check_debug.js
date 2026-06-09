const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
  const counsellors = await User.find({ role: 'counsellor' });
  console.log('--- COUNSELLORS ---');
  counsellors.forEach(c => console.log(`Name: ${c.name}, Email: ${c.email}, ID: ${c._id}`));

  const leads = await Lead.find({});
  console.log('--- LEADS ---');
  leads.forEach(l => console.log(`Name: ${l.name}, Status: ${l.status}, AssignedTo: ${l.assignedTo}`));

  await mongoose.disconnect();
}

run();
