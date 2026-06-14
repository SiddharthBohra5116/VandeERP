require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');
const connectDB = require('../config/db');
const { filterValidAttendance } = require('../utils/attendanceHelper');

async function runTests() {
  console.log('🧪 Starting Automated Integration Verification Tests...');
  await connectDB();

  // Test 1: Holidays seeding check
  const holidayCount = await Holiday.countDocuments({});
  console.log(`- Holiday Count: ${holidayCount} (Expected: >0)`);
  if (holidayCount === 0) throw new Error("Holiday check failed: No holidays found");

  // Test 2: LeaveRequest creation & check
  const leaveCount = await LeaveRequest.countDocuments({});
  console.log(`- Leave Requests: ${leaveCount} (Expected: >0)`);
  if (leaveCount === 0) throw new Error("LeaveRequest check failed: No requests found");

  // Test 3: Retrieve one student and verify attendance helper logic
  const student = await User.findOne({ role: 'student', status: 'active' });
  if (student) {
    console.log(`- Found Active Student: ${student.name}`);
    const records = await Attendance.find({ student: student._id });
    console.log(`- Raw Attendance Record Count: ${records.length}`);
    
    const validRecords = await filterValidAttendance(records);
    console.log(`- Filtered Valid Attendance Record Count: ${validRecords.length}`);
    
    // Verify that filtered records is less than or equal to raw records
    if (validRecords.length > records.length) {
      throw new Error("Helper check failed: Filtered records cannot be more than raw records");
    }
  }

  // Test 4: Graduation and Certificate check
  const completeUser = await User.findOne({ role: 'student', status: 'complete' });
  if (completeUser) {
    console.log(`- Found Graduated Student: ${completeUser.name}`);
    const Student = require('../models/Student');
    const completeStudent = await Student.findOne({ userId: completeUser._id });
    if (!completeStudent || !completeStudent.feedback || !completeStudent.feedback.submitted) {
      throw new Error("Completed student must have submitted feedback");
    }
    console.log("- Certificate Unlocking status: UNLOCKED");
  }

  console.log('🎉 All Automated Integration Tests Passed Successfully!');
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('❌ Verification Tests Failed:', err);
  process.exit(1);
});
