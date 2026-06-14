const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Lead = require('../models/Lead');
const Expense = require('../models/Expense');
const RevenueTarget = require('../models/RevenueTarget');
const Schedule = require('../models/Schedule');
const Progress = require('../models/Progress');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function getCookies(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  return setCookie.map(c => c.split(';')[0]).join('; ');
}

async function run() {
  console.log('🚀 Starting Verification for Day 8 Tasks...');

  const env = { ...process.env, PORT: '3132', NODE_ENV: 'development' };
  const serverProc = spawn('node', ['server.js'], { cwd: process.cwd(), env });

  serverProc.stdout.on('data', (data) => {
    console.log(`[Server Out]: ${data.toString().trim()}`);
  });

  serverProc.stderr.on('data', (data) => {
    console.error(`[Server Err]: ${data.toString().trim()}`);
  });

  console.log('⏳ Waiting for server to spin up...');
  await sleep(4000);

  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
    
    console.log('\n🌱 Seeding test database records...');
    
    // Clear previous test records
    await User.deleteMany({ email: /day8.*@example\.com/ });
    await Lead.deleteMany({ name: /Day8 Lead.*/ });
    await Fee.deleteMany({});
    await Attendance.deleteMany({ date: /2026-06.*/ });
    await Assignment.deleteMany({});
    await Progress.deleteMany({});
    await Schedule.deleteMany({});
    await Expense.deleteMany({ month: '2026-06' });
    await RevenueTarget.deleteMany({ month: '2026-06' });
    await Student.deleteMany({});
    await Batch.deleteMany({ name: 'Day8Batch' });

    // 1. Create Course and Batch
    let courseDoc = await Course.findOne({ name: 'Video Editing' });
    if (!courseDoc) {
      courseDoc = await Course.create({
        name: 'Video Editing',
        code: 'VE',
        durationMonths: 3,
        fees: 25000
      });
    }

    // 2. Create Admin, Counsellor, Teacher, and Student
    let adminUser = await User.findOne({ email: 'admin@vandedigital.com' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'System Admin',
        email: 'admin@vandedigital.com',
        password: 'password123',
        role: 'admin',
        phone: '8881112220',
        isActive: true,
        status: 'active'
      });
    }

    const counsellor = await User.create({
      name: 'Day8 Counsellor',
      email: 'day8counsellor@example.com',
      password: 'password123',
      role: 'counsellor',
      phone: '8881112221',
      isActive: true
    });

    const teacher = await User.create({
      name: 'Day8 Teacher',
      email: 'day8teacher@example.com',
      password: 'password123',
      role: 'teacher',
      phone: '8881112222',
      isActive: true
    });

    const batchDoc = await Batch.create({
      name: 'Day8Batch',
      course: courseDoc._id,
      teachers: [teacher._id],
      capacity: 20,
      isActive: true
    });

    const user = await User.create({
      name: 'Day8 Student',
      email: 'day8student@example.com',
      password: 'password123',
      role: 'student',
      phone: '8881112223',
      isActive: true
    });

    const student = await Student.create({
      user: user._id,
      course: courseDoc._id,
      batch: batchDoc._id,
      teacher: teacher._id,
      counsellor: counsellor._id,
      enrollmentDate: new Date('2026-06-05')
    });

    // 3. Seed Financial & Operational details
    await RevenueTarget.create({ month: '2026-06', amount: 50000 });
    await Expense.create({ month: '2026-06', category: 'staff', amount: 15000, date: new Date('2026-06-10') });

    const fee = await Fee.create({
      student: student._id,
      course: courseDoc._id,
      batch: batchDoc._id,
      totalAmount: 40000,
      discount: 5000,
      paidAmount: 15000,
      dueDate: new Date('2026-05-15'), // Overdue fee
      installments: [
        { name: 'Down Payment', amount: 20000, paidAmount: 15000, dueDate: new Date('2026-06-01') },
        { name: 'Installment 1', amount: 15000, paidAmount: 0, dueDate: new Date('2026-05-15') } // Overdue installment
      ],
      payments: [
        { amount: 15000, method: 'UPI', paidAt: new Date('2026-06-05') }
      ]
    });

    // Low attendance record to flag student as At-Risk
    await Attendance.create({
      student: student._id,
      teacher: teacher._id,
      course: courseDoc._id,
      batch: batchDoc._id,
      date: '2026-06-08',
      status: 'absent'
    });

    // Seed assignments and submissions to check teacher workload metrics
    const assignment = await Assignment.create({
      title: 'Day8 Color Grading',
      course: courseDoc._id,
      batch: batchDoc._id,
      teacher: teacher._id,
      dueDate: new Date('2026-06-12'),
      totalMarks: 100,
      submissions: [
        { student: student._id, status: 'graded', marks: 85, feedback: 'Great job!', submittedAt: new Date('2026-06-09') }
      ]
    });

    await Lead.create({
      name: 'Day8 Lead A',
      phone: '9998887771',
      interestedCourse: courseDoc._id,
      source: 'Website',
      status: 'admission_completed',
      assignedTo: counsellor._id,
      convertedStudent: student._id,
      createdAt: new Date('2026-06-02'),
      convertedAt: new Date('2026-06-05')
    });

    // Helper: Login and return cookies
    const login = async (email, password = 'password123') => {
      const loginData = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
      const res = await makeRequest({
        hostname: 'localhost', port: 3132, path: '/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(loginData) }
      }, loginData);
      return getCookies(res.headers);
    };

    console.log('🔑 Logging in as Admin...');
    const adminCookie = await login('admin@vandedigital.com');

    // Test Admin Reports page with date range filter
    console.log('\n👣 Requesting Admin Reports with date filter...');
    const reportsRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/admin/reports?tab=academic&startDate=2026-06-01&endDate=2026-06-30', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    if (reportsRes.statusCode !== 200) {
      throw new Error(`Admin Reports overview tab failed: ${reportsRes.statusCode}`);
    }
    console.log('   ✅ Admin Reports overview tab loaded (HTTP 200).');

    // Verify presence of at-risk action buttons
    if (!reportsRes.data.includes('btn-send-msg') || !reportsRes.data.includes('btn-view-fee') || !reportsRes.data.includes('btn-view-att')) {
      throw new Error('At-Risk Students section is missing inline Action buttons.');
    }
    console.log('   ✅ At-Risk Students Action buttons verified (Send Message, View Fee, View Attendance).');

    // Test Admin Reports Staff tab
    const staffReportsRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/admin/reports?tab=staff&startDate=2026-06-01&endDate=2026-06-30', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });
    if (staffReportsRes.statusCode !== 200 || !staffReportsRes.data.includes('teacherLoadChart')) {
      throw new Error('Admin Reports staff tab failed to load or missing teacherLoadChart.');
    }
    console.log('   ✅ Admin Reports staff tab workload charts verified.');

    // Test Counsellor Reports page
    console.log('\n👣 Logging in as Counsellor and checking performance reports...');
    const counsellorCookie = await login('day8counsellor@example.com');
    const counsellorReportsRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/counsellor/reports', method: 'GET',
      headers: { 'Cookie': counsellorCookie }
    });

    if (counsellorReportsRes.statusCode !== 200 || !counsellorReportsRes.data.includes('My Admitted Students Health Cohort Grid')) {
      throw new Error(`Counsellor reports page failed, status: ${counsellorReportsRes.statusCode}`);
    }
    console.log('   ✅ Counsellor reports dashboard with student health cohort grid loaded (HTTP 200).');

    // Test Student Analytics page
    console.log('\n👣 Logging in as Student and checking analytics trends...');
    const studentCookie = await login('day8student@example.com');
    const studentAnalyticsRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/student/analytics', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });

    if (studentAnalyticsRes.statusCode !== 200 || !studentAnalyticsRes.data.includes('studentAttendanceChart')) {
      throw new Error(`Student analytics page failed, status: ${studentAnalyticsRes.statusCode}`);
    }
    console.log('   ✅ Student analytics dashboard with visual trends loaded (HTTP 200).');

    console.log('\n🎉 ALL DAY 8 INTEGRATION AND PERFORMANCE CHECKS PASSED GREEN!');

  } catch (err) {
    console.error('❌ Day 8 Verification Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n🛑 Cleaning up test server and db connection...');
    serverProc.kill();
    await mongoose.disconnect();
    console.log('👋 Cleaned up. Exiting.');
  }
}

run();
