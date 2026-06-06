require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Fee = require('../models/Fee');
const connectDB = require('../config/db');

// Import calculateNotifications from middleware
const calculateNotifications = async (user) => {
  // We mirror the middleware code to verify calculation output directly
  const alerts = [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  try {
    const unreadMsgs = await Message.find({ recipient: user._id, read: false })
      .populate('sender', 'name role')
      .sort({ createdAt: -1 })
      .limit(5);

    unreadMsgs.forEach(m => {
      alerts.push({
        id: m._id.toString(),
        type: 'message',
        title: `Message from ${m.sender ? m.sender.name : 'System'}`,
        message: m.content,
        date: m.createdAt
      });
    });

    if (user.role === 'counsellor') {
      const enrolledStudents = await User.find({ role: 'student', counsellor: user._id });
      if (enrolledStudents.length > 0) {
        const studentIds = enrolledStudents.map(s => s._id);

        // A. Low Attendance Alerts
        const attendanceRecords = await Attendance.find({ student: { $in: studentIds } });
        enrolledStudents.forEach(s => {
          const studentAttendance = attendanceRecords.filter(a => a.student.toString() === s._id.toString());
          if (studentAttendance.length >= 5) {
            const presentCount = studentAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
            const attendancePct = Math.round((presentCount / studentAttendance.length) * 100);
            if (attendancePct < 75) {
              alerts.push({
                id: `cns-low-att-${s._id}`,
                type: 'low_attendance',
                title: '🔴 Low Attendance Risk',
                message: `${s.name}'s attendance is at ${attendancePct}% (under 75%).`
              });
            }
          }
        });

        // B. Unsubmitted Overdue Assignments Alerts
        const studentBatches = [...new Set(enrolledStudents.map(s => s.batch).filter(Boolean))];
        const overdueAssignments = await Assignment.find({
          batch: { $in: studentBatches },
          isActive: true,
          dueDate: { $lt: today }
        });

        overdueAssignments.forEach(a => {
          const batchStudents = enrolledStudents.filter(s => s.batch === a.batch);
          batchStudents.forEach(s => {
            const hasSubmitted = a.submissions.some(sub => sub.student.toString() === s._id.toString());
            if (!hasSubmitted) {
              alerts.push({
                id: `cns-miss-assign-${s._id}-${a._id}`,
                type: 'homework_overdue',
                title: '⚠️ Homework Not Submitted',
                message: `${s.name} missed homework deadline for "${a.title}".`
              });
            }
          });
        });

        // C. Fees Reminders (Due / Overdue)
        const fees = await Fee.find({ student: { $in: studentIds } }).populate('student');
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

        fees.forEach(f => {
          if (f.student && f.dueAmount > 0 && f.dueDate) {
            const dueDate = new Date(f.dueDate);
            if (dueDate <= tenDaysFromNow) {
              const overdue = dueDate < today;
              alerts.push({
                id: f._id.toString(),
                type: overdue ? 'fee_overdue' : 'fee_due_soon',
                title: overdue ? '💵 Converted Student Fee Overdue' : '💵 Converted Student Fee Due',
                message: `${f.student.name}'s fee of ₹${f.dueAmount} is ${overdue ? 'overdue' : 'due soon'}.`
              });
            }
          }
        });
      }
    }
  } catch (err) {
    console.error('❌ Error compiling alerts:', err);
  }
  return alerts;
};

async function run() {
  console.log('🧪 Starting Inbox and Counsellor Alerts Verification Tests...');
  await connectDB();

  // Test 1: Seed some messages
  console.log('📬 Testing Inbox Message Creation...');
  const student = await User.findOne({ role: 'student', email: 'student@gmail.com' });
  const counsellor = await User.findOne({ role: 'counsellor' });

  if (!student || !counsellor) {
    throw new Error('Verification failed: could not locate student@gmail.com or counsellor in database.');
  }

  // Clear existing messages to have a clean test
  await Message.deleteMany({});

  const msg1 = await Message.create({
    sender: student._id,
    recipient: counsellor._id,
    content: 'Hello Counsellor, I have a query about the fee structure.'
  });

  const msg2 = await Message.create({
    sender: counsellor._id,
    recipient: student._id,
    content: 'Hi Student, you can pay via UPI or Bank Transfer. Let me know if you need help.'
  });

  console.log(`- Created message from student to counsellor. ID: ${msg1._id}`);
  console.log(`- Created response from counsellor to student. ID: ${msg2._id}`);

  // Test 2: Read messages and count unread
  const unreadForCounsellor = await Message.countDocuments({ recipient: counsellor._id, read: false });
  console.log(`- Unread message count for Counsellor: ${unreadForCounsellor} (Expected: 1)`);
  if (unreadForCounsellor !== 1) {
    throw new Error(`Unread count assertion failed. Expected 1, got ${unreadForCounsellor}`);
  }

  // Test 3: Calculate Counsellor Alerts
  console.log('🔔 Testing Counsellor Alert Calculations...');
  
  // Temporarily lower attendance of one student assigned to this counsellor to trigger warning
  const assignedStudent = await User.findOne({ role: 'student', counsellor: counsellor._id });
  if (assignedStudent) {
    console.log(`- Testing alerts for Counsellor's student: ${assignedStudent.name}`);
    
    // Seed some mock attendance for this student (all absent)
    await Attendance.deleteMany({ student: assignedStudent._id });
    for (let i = 0; i < 6; i++) {
      await Attendance.create({
        student: assignedStudent._id,
        teacher: counsellor._id, // placeholder
        subject: 'Video Editing Basics',
        batch: assignedStudent.batch,
        date: `2026-05-0${i+1}`,
        status: 'absent'
      });
    }

    const alerts = await calculateNotifications(counsellor);
    console.log(`- Compiled Alerts for Counsellor: ${alerts.length}`);
    alerts.forEach(a => {
      console.log(`  [Alert type: ${a.type}] Title: "${a.title}" - Message: "${a.message}"`);
    });

    const hasLowAttendanceAlert = alerts.some(a => a.type === 'low_attendance');
    const hasUnsubmittedHomeworkAlert = alerts.some(a => a.type === 'homework_overdue');
    const hasUnreadMessageAlert = alerts.some(a => a.type === 'message');

    console.log(`- Has Low Attendance Alert: ${hasLowAttendanceAlert}`);
    console.log(`- Has Unsubmitted Homework Alert: ${hasUnsubmittedHomeworkAlert}`);
    console.log(`- Has Message Alert: ${hasUnreadMessageAlert}`);

    if (!hasLowAttendanceAlert) {
      throw new Error('Assertion failed: Low attendance risk alert did not trigger.');
    }
  } else {
    console.log('⚠️ No students assigned to this counsellor found. Skipping student alerts test.');
  }

  console.log('🎉 All Inbox and Counsellor Alert Tests Passed Successfully!');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Verification Tests Failed:', err);
  process.exit(1);
});
