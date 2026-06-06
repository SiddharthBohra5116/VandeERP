require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const connectDB = require('../config/db');

// Import handlers from authController directly
const ctrl = require('../controllers/authController');

async function run() {
  console.log('🧪 Starting Notifications Mark-as-Read Verification Tests...');
  await connectDB();

  // Find a student
  const student = await User.findOne({ role: 'student', email: 'student@gmail.com' });
  if (!student) {
    throw new Error('Could not find student@gmail.com user');
  }

  // Clear previous readNotifications
  student.readNotifications = [];
  await student.save();
  console.log(`- Cleared readNotifications for ${student.name}`);

  // Test 1: Mark a single dummy notification as read
  console.log('🔔 Testing individual notification dismiss endpoint...');
  const dummyId = 'low-att-risk-999';
  
  // Simulate request/response context
  let resJsonData = null;
  const mockReq1 = {
    params: { id: dummyId },
    user: { _id: student._id }
  };
  const mockRes1 = {
    json: (data) => { resJsonData = data; }
  };

  await ctrl.postReadNotification(mockReq1, mockRes1);
  console.log('- Endpoint response:', resJsonData);
  if (!resJsonData || !resJsonData.ok) {
    throw new Error('Single read endpoint failed to return ok: true');
  }

  // Fetch student again and verify
  const updatedStudent1 = await User.findById(student._id);
  console.log('- Student readNotifications after update:', updatedStudent1.readNotifications);
  if (!updatedStudent1.readNotifications.includes(dummyId)) {
    throw new Error('Dummy notification ID was not added to user readNotifications array.');
  }

  // Test 2: Mark multiple notifications as read (Read All)
  console.log('🔔 Testing mark-all-notifications-read endpoint...');
  const dummyIds = ['homework-miss-111', 'fee-due-222', 'schedule-today-333'];
  let resJsonDataAll = null;
  const mockReq2 = {
    body: { ids: dummyIds },
    user: { _id: student._id }
  };
  const mockRes2 = {
    json: (data) => { resJsonDataAll = data; }
  };

  await ctrl.postReadAllNotifications(mockReq2, mockRes2);
  console.log('- Endpoint response:', resJsonDataAll);
  if (!resJsonDataAll || !resJsonDataAll.ok) {
    throw new Error('Read all endpoint failed to return ok: true');
  }

  // Fetch student again and verify
  const updatedStudent2 = await User.findById(student._id);
  console.log('- Student readNotifications after read-all update:', updatedStudent2.readNotifications);
  const allAdded = dummyIds.every(id => updatedStudent2.readNotifications.includes(id));
  if (!allAdded) {
    throw new Error('Not all notification IDs were added during read-all request.');
  }

  console.log('🎉 All Notifications Read Verification Tests Passed Successfully!');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Verification Tests Failed:', err);
  process.exit(1);
});
