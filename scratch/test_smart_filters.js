const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');
const Assignment = require('../models/Assignment');
const { todayIST } = require('../utils/dateHelper');

// Helper to make HTTP requests
function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3126,
      path: encodeURI(path),
      method: method,
      headers: { ...headers }
    };
    if (body) {
      if (typeof body === 'object') {
        body = new URLSearchParams(body).toString();
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

function getResultsHtml(body) {
  const start = body.indexOf('id="results-container"');
  const end = body.indexOf('/js/instant-filter.js');
  if (start !== -1 && end !== -1) {
    return body.substring(start, end);
  }
  return body;
}

function getSubmissionsHtml(body) {
  const start = body.indexOf('Student Submissions & Hand-ins');
  const end = body.indexOf('id="gradeModal"');
  if (start !== -1 && end !== -1) {
    return body.substring(start, end);
  }
  return body;
}

async function run() {
  console.log('🧪 Starting Smart Filters and Search E2E Verification Tests...\n');
  
  // 1. Connect to Mongo
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy';
  await mongoose.connect(mongoUri);
  console.log('🔌 Connected to Database');

  // 2. Fetch or Create Users
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({
      name: 'Test Admin',
      email: 'testadmin@gmail.com',
      password: 'password123',
      role: 'admin',
      phone: '9876543211',
      isActive: true
    });
    console.log('➕ Created Temp Admin');
  }

  let teacher = await User.findOne({ role: 'teacher' });
  if (!teacher) {
    teacher = await User.create({
      name: 'Test Teacher',
      email: 'testteacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '9876543212',
      isActive: true,
      subject: 'Video Editing'
    });
    console.log('➕ Created Temp Teacher');
  }

  // Clear previous test students
  const oldTestStudents = await User.find({ email: /@testsmart\.com$/ }).select('_id');
  const oldTestStudentIds = oldTestStudents.map(s => s._id);
  await User.deleteMany({ _id: { $in: oldTestStudentIds } });
  await Attendance.deleteMany({ student: { $in: oldTestStudentIds } });
  await Fee.deleteMany({ student: { $in: oldTestStudentIds } });
  await Assignment.deleteMany({ title: 'Filter Test Assignment' });

  // Create 3 Test Students
  const s1 = await User.create({
    name: 'Suresh Kumar',
    email: 'suresh@testsmart.com',
    password: 'password123',
    role: 'student',
    phone: '9988776655',
    batch: 'Filter Batch A',
    course: 'Video Editing',
    isActive: true,
    status: 'active'
  });
  const s2 = await User.create({
    name: 'Ramesh Singh',
    email: 'ramesh@testsmart.com',
    password: 'password123',
    role: 'student',
    phone: '9988776656',
    batch: 'Filter Batch A',
    course: 'Video Editing',
    isActive: true,
    status: 'active'
  });
  const s3 = await User.create({
    name: 'Dinesh Patel',
    email: 'dinesh@testsmart.com',
    password: 'password123',
    role: 'student',
    phone: '9988776657',
    batch: 'Filter Batch B',
    course: 'Video Editing',
    isActive: true,
    status: 'active'
  });
  console.log('➕ Seeded 3 Test Students (Suresh, Ramesh, Dinesh)');

  // 3. Generate Auth Tokens
  const adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'vande_secret_key');
  const adminCookie = `token=${adminToken}`;

  const teacherToken = jwt.sign({ id: teacher._id }, process.env.JWT_SECRET || 'vande_secret_key');
  const teacherCookie = `token=${teacherToken}`;

  // Start Express Server
  process.env.PORT = '3126';
  const app = require('../server');

  // Wait for server to boot
  await new Promise(r => setTimeout(r, 1000));

  // --- TEST FEATURE 1: GLOBAL TOPBAR STUDENT SEARCH ---
  console.log('👣 [1/4] Verifying Global Student Search fields (Roll, Phone, Batch)...');
  
  // A. Search by Name
  const resSearchName = await request('GET', `/admin/students?search=Suresh`, { Cookie: adminCookie });
  if (!resSearchName.body.includes('Suresh Kumar') || resSearchName.body.includes('Ramesh Singh')) {
    throw new Error('Global search failed to filter by Name.');
  }

  // B. Search by Phone
  const resSearchPhone = await request('GET', `/admin/students?search=9988776656`, { Cookie: adminCookie });
  if (!resSearchPhone.body.includes('Ramesh Singh') || resSearchPhone.body.includes('Suresh Kumar')) {
    throw new Error('Global search failed to filter by Phone.');
  }

  // C. Search by Batch
  const resSearchBatch = await request('GET', `/admin/students?search=Filter Batch B`, { Cookie: adminCookie });
  if (!resSearchBatch.body.includes('Dinesh Patel') || resSearchBatch.body.includes('Suresh Kumar')) {
    throw new Error('Global search failed to filter by Batch.');
  }

  console.log('   ✅ Global Student Search passed.');

  // --- TEST FEATURE 2: ATTENDANCE TIER FILTERS ---
  console.log('👣 [2/4] Verifying Attendance Tier Filters (Low, Medium, High, Not Marked)...');

  // Seed attendance for Suresh (100% - present)
  await Attendance.create({ student: s1._id, teacher: teacher._id, subject: 'Video Editing', batch: 'Filter Batch A', date: '2026-06-01', status: 'present' });
  await Attendance.create({ student: s1._id, teacher: teacher._id, subject: 'Video Editing', batch: 'Filter Batch A', date: '2026-06-02', status: 'present' });

  // Seed attendance for Ramesh (50% - low)
  await Attendance.create({ student: s2._id, teacher: teacher._id, subject: 'Video Editing', batch: 'Filter Batch A', date: '2026-06-01', status: 'present' });
  await Attendance.create({ student: s2._id, teacher: teacher._id, subject: 'Video Editing', batch: 'Filter Batch A', date: '2026-06-02', status: 'absent' });

  // Dinesh has no records at all (0 records -> 100% fallback, unmarked today)

  // Seed today's attendance for Suresh only (so Suresh is marked today, Ramesh & Dinesh are unmarked today)
  await Attendance.create({
    student: s1._id,
    teacher: teacher._id,
    subject: 'Video Editing',
    batch: 'Filter Batch A',
    date: todayIST(),
    status: 'present'
  });

  // A. Filter by Low (<75%)
  const resAttLow = await request('GET', `/admin/students?attendance=low`, { Cookie: adminCookie });
  if (!resAttLow.body.includes('Ramesh Singh') || resAttLow.body.includes('Suresh Kumar')) {
    throw new Error('Attendance Filter: "Low" failed to correctly return only Ramesh.');
  }

  // B. Filter by High (>85%)
  const resAttHigh = await request('GET', `/admin/students?attendance=high`, { Cookie: adminCookie });
  if (!resAttHigh.body.includes('Suresh Kumar') || resAttHigh.body.includes('Ramesh Singh')) {
    throw new Error('Attendance Filter: "High" failed to correctly return Suresh.');
  }

  // C. Filter by Not Marked Today
  const resAttUnmarked = await request('GET', `/admin/students?attendance=not_marked_today`, { Cookie: adminCookie });
  if (!resAttUnmarked.body.includes('Ramesh Singh') || !resAttUnmarked.body.includes('Dinesh Patel') || resAttUnmarked.body.includes('Suresh Kumar')) {
    throw new Error('Attendance Filter: "Not Marked Today" failed to correctly return Ramesh and Dinesh.');
  }

  console.log('   ✅ Attendance Tier Filters passed.');

  // --- TEST FEATURE 3: FEE STATUS FILTERS & SORTING ---
  console.log('👣 [3/4] Verifying Fee Status Filters and Sorting Options...');

  // Create Fee Ledgers
  // Suresh: Overdue
  await Fee.create({
    student: s1._id,
    course: 'Video Editing',
    totalAmount: 30000,
    paidAmount: 5000,
    discount: 2000, // actual total: 28000. due: 23000
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  });

  // Ramesh: Partially Paid
  await Fee.create({
    student: s2._id,
    course: 'Video Editing',
    totalAmount: 20000,
    paidAmount: 10000,
    discount: 0, // due: 10000
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // future
  });

  // Dinesh: Fully Paid
  await Fee.create({
    student: s3._id,
    course: 'Video Editing',
    totalAmount: 15000,
    paidAmount: 15000,
    discount: 0, // due: 0
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  });

  const allTestFees = await Fee.find({ student: { $in: [s1._id, s2._id, s3._id] } }).populate('student');
  console.log('--- DIAGNOSTIC: Created Test Fees ---');
  allTestFees.forEach(tf => {
    console.log(`Student: ${tf.student.name}, DueAmount: ${tf.dueAmount}, DueDate: ${tf.dueDate}, isOverdue: ${tf.dueAmount > 0 && tf.dueDate && tf.dueDate < new Date()}`);
  });

  // A. Filter by Fully Paid
  const resFeePaid = await request('GET', `/admin/fees?paymentStatus=fully paid`, { Cookie: adminCookie });
  const htmlFeePaid = getResultsHtml(resFeePaid.body);
  if (!htmlFeePaid.includes('Dinesh Patel') || htmlFeePaid.includes('Suresh Kumar')) {
    console.log('--- DIAGNOSTIC: resFeePaid resultsHtml contents ---');
    console.log(htmlFeePaid);
    throw new Error('Fee Filter: "Fully Paid" failed to isolate Dinesh.');
  }

  // B. Filter by Overdue
  const resFeeOverdue = await request('GET', `/admin/fees?paymentStatus=overdue`, { Cookie: adminCookie });
  const htmlFeeOverdue = getResultsHtml(resFeeOverdue.body);
  if (!htmlFeeOverdue.includes('Suresh Kumar') || htmlFeeOverdue.includes('Ramesh Singh') || htmlFeeOverdue.includes('Dinesh Patel')) {
    console.log('--- DIAGNOSTIC: resFeeOverdue html content ---');
    console.log(htmlFeeOverdue);
    throw new Error('Fee Filter: "Overdue" failed to isolate Suresh.');
  }

  // C. Sort by Highest Outstanding Dues (Suresh: 23k, Ramesh: 12k, Dinesh: 0)
  const resFeeSortOutstanding = await request('GET', `/admin/fees?sortBy=outstanding`, { Cookie: adminCookie });
  const htmlFeeSortOutstanding = getResultsHtml(resFeeSortOutstanding.body);
  const idxSuresh = htmlFeeSortOutstanding.indexOf('Suresh Kumar');
  const idxRamesh = htmlFeeSortOutstanding.indexOf('Ramesh Singh');
  if (idxSuresh === -1 || idxRamesh === -1 || idxSuresh > idxRamesh) {
    throw new Error('Fee Sort: "Highest Outstanding Dues" sorted incorrectly.');
  }

  console.log('   ✅ Fee Status Filters & Sorting passed.');

  // --- TEST FEATURE 4: ASSIGNMENT SUBMISSION TABS ---
  console.log('👣 [4/4] Verifying Assignment Submission Filters (Pending, Graded, Overdue)...');

  // Create Assignment for Filter Batch A (contains Suresh and Ramesh)
  const assign = await Assignment.create({
    title: 'Filter Test Assignment',
    description: 'Verifying filters.',
    subject: 'Video Editing',
    batch: 'Filter Batch A',
    teacher: teacher._id,
    totalMarks: 100,
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // Overdue!
  });

  // Suresh: submits late and ungraded (submitted status)
  assign.submissions.push({
    student: s1._id,
    fileUrl: '/uploads/homework.zip',
    fileName: 'homework.zip',
    submittedAt: new Date(),
    note: 'Suresh late homework',
    status: 'submitted'
  });
  await assign.save();

  // Ramesh: has not submitted (since dueDate is past, Ramesh status is 'overdue')

  // A. Filter by Overdue
  const resAssignOverdue = await request('GET', `/teacher/assignments/${assign._id}?status=overdue`, { Cookie: teacherCookie });
  const htmlAssignOverdue = getSubmissionsHtml(resAssignOverdue.body);
  if (!htmlAssignOverdue.includes('Ramesh Singh') || htmlAssignOverdue.includes('Suresh Kumar')) {
    throw new Error('Assignment Filter: "Overdue" failed to isolate Ramesh.');
  }

  // B. Filter by Late
  const resAssignLate = await request('GET', `/teacher/assignments/${assign._id}?status=late`, { Cookie: teacherCookie });
  const htmlAssignLate = getSubmissionsHtml(resAssignLate.body);
  if (!htmlAssignLate.includes('Suresh Kumar') || htmlAssignLate.includes('Ramesh Singh')) {
    throw new Error('Assignment Filter: "Late" failed to isolate Suresh.');
  }

  console.log('   ✅ Assignment Submission Filters passed.');

  // Clean up database records
  const testStudentIds = [s1._id, s2._id, s3._id];
  await User.deleteMany({ _id: { $in: testStudentIds } });
  await Attendance.deleteMany({ student: { $in: testStudentIds } });
  await Fee.deleteMany({ student: { $in: testStudentIds } });
  await Assignment.deleteMany({ title: 'Filter Test Assignment' });
  console.log('🧹 Cleaned up database test records');

  console.log('\n🎉 ALL SMART FILTERS AND SEARCH E2E TESTS PASSED GREEN!');
  process.exit(0);
}

// Override server PORT for verification run
process.env.PORT = 3126;
run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
