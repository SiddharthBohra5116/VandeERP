const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Schedule = require('../models/Schedule');
const Message = require('../models/Message');
const Classroom = require('../models/Classroom');
const Timetable = require('../models/Timetable');
const Holiday = require('../models/Holiday');

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
    req.on('error', (e) => { reject(e); });
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
  console.log('🚀 Starting Verification for Day 7 Tasks...');
  
  // Start server on port 3132
  const env = { ...process.env, PORT: '3132', NODE_ENV: 'test' };
  const serverProc = spawn('node', ['server.js'], { cwd: process.cwd(), env });

  serverProc.stderr.on('data', (data) => {
    console.error(`[Server Err]: ${data.toString().trim()}`);
  });

  console.log('⏳ Waiting for server to spin up...');
  await sleep(4000);

  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
    
    console.log('\n🌱 Seeding test database records...');
    
    // Clear previous test records
    await User.deleteMany({ email: /day7.*@example\.com/ });
    await Schedule.deleteMany({ batch: 'Day7Batch' });
    await Timetable.deleteMany({ batch: 'Day7Batch' });
    await Classroom.deleteMany({ name: /Day7 Room.*/ });
    await Holiday.deleteMany({ date: '2026-06-10' }); // Wed

    // Create Classroom
    const classroom1 = await Classroom.create({
      name: 'Day7 Room A',
      capacity: 30
    });

    const classroom2 = await Classroom.create({
      name: 'Day7 Room B',
      capacity: 20
    });

    // Create Teacher
    const teacher = await User.create({
      name: 'Day7 Teacher',
      email: 'day7teacher@example.com',
      password: 'password123',
      role: 'teacher',
      phone: '9991112221',
      isActive: true
    });

    // Create Student
    const student = await User.create({
      name: 'Day7 Student',
      email: 'day7student@example.com',
      password: 'password123',
      role: 'student',
      phone: '9991112222',
      course: 'Video Editing',
      batch: 'Day7Batch',
      teacher: teacher._id,
      isActive: true
    });

    // Create a holiday on a Wednesday (2026-06-10)
    await Holiday.create({
      name: 'Day7 Holiday',
      date: '2026-06-10'
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

    // 1. Timetable propagation logic E2E test
    console.log('\n👣 Saving Timetable Template (Monday to Friday) for Day7Batch...');
    // Dates range: Mon 2026-06-08 to Fri 2026-06-12 (5 days)
    // Mon (8), Tue (9), Wed (10 - Holiday), Thu (11), Fri (12)
    // Sat (13), Sun (14) - Should not generate schedules even if we extend end date
    const timetablePostData = [
      'batch=Day7Batch',
      'startDate=2026-06-08',
      'endDate=2026-06-14',
      // Slot 1: Monday
      'dayOfWeek=Monday',
      'subject=Editing Basic',
      `teacher=${teacher._id}`,
      `classroom=${classroom1._id}`,
      'startTime=09:00 AM',
      'endTime=11:00 AM',
      // Slot 2: Wednesday
      'dayOfWeek=Wednesday',
      'subject=Resolve Color',
      `teacher=${teacher._id}`,
      `classroom=${classroom1._id}`,
      'startTime=09:00 AM',
      'endTime=11:00 AM',
      // Slot 3: Friday
      'dayOfWeek=Friday',
      'subject=Editing Master',
      `teacher=${teacher._id}`,
      `classroom=${classroom1._id}`,
      'startTime=09:00 AM',
      'endTime=11:00 AM',
      // Slot 4: Saturday (Weekend - should be skipped by generator)
      'dayOfWeek=Saturday',
      'subject=Weekend Special',
      `teacher=${teacher._id}`,
      `classroom=${classroom1._id}`,
      'startTime=09:00 AM',
      'endTime=11:00 AM'
    ].join('&');

    const timetableSaveRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/admin/timetables', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(timetablePostData),
        'Cookie': adminCookie
      }
    }, timetablePostData);

    if (timetableSaveRes.statusCode !== 302) {
      throw new Error(`Failed to save timetable template, status: ${timetableSaveRes.statusCode}`);
    }

    // Verify generated schedule items in Database
    const generatedSchedules = await Schedule.find({ batch: 'Day7Batch' }).sort({ date: 1 });
    console.log(`📊 Generated schedules count: ${generatedSchedules.length}`);
    
    // We expect:
    // - Monday 2026-06-08: "Editing Basic" (Valid)
    // - Wednesday 2026-06-10: Skipped (Holiday)
    // - Friday 2026-06-12: "Editing Master" (Valid)
    // - Saturday 2026-06-13: Skipped (Weekend)
    // So total should be exactly 2 schedules!
    if (generatedSchedules.length !== 2) {
      throw new Error(`Expected exactly 2 schedules (Monday & Friday), but found ${generatedSchedules.length}. Holidays/Weekends logic failed.`);
    }

    const firstSched = generatedSchedules[0];
    const secondSched = generatedSchedules[1];

    if (firstSched.date !== '2026-06-08' || firstSched.subject !== 'Editing Basic') {
      throw new Error(`Expected first schedule to be Monday 2026-06-08 "Editing Basic", got ${firstSched.date} ${firstSched.subject}`);
    }

    if (secondSched.date !== '2026-06-12' || secondSched.subject !== 'Editing Master') {
      throw new Error(`Expected second schedule to be Friday 2026-06-12 "Editing Master", got ${secondSched.date} ${secondSched.subject}`);
    }
    console.log('✅ Timetable propagation successfully generated schedules, skipping weekends and holidays!');

    // 2. Teacher timetable view & Mark Complete button E2E
    // Let's modify the first schedule date to be "today" to make sure it appears on the teacher's today schedule
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    firstSched.date = todayStr;
    await firstSched.save();

    console.log('\n👣 Verifying Teacher dashboard today schedule...');
    const teacherCookie = await login('day7teacher@example.com');
    const teacherDashboard = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/teacher/dashboard', method: 'GET',
      headers: { 'Cookie': teacherCookie }
    });

    if (!teacherDashboard.data.includes('Editing Basic') || !teacherDashboard.data.includes('Mark Complete')) {
      throw new Error('Teacher dashboard today schedule does not display today class or missing Mark Complete button.');
    }
    console.log('✅ Teacher dashboard today schedule renders correctly with Mark Complete button!');

    // Test Mark Complete action
    console.log('\n👣 Submitting Class Mark Complete action as Teacher...');
    const completeData = 'note=Covered+timeline+editing+concepts';
    const completeRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: `/teacher/schedules/${firstSched._id}/complete`, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(completeData),
        'Cookie': teacherCookie
      }
    }, completeData);

    if (completeRes.statusCode !== 302) {
      throw new Error(`Expected 302 redirect after mark complete, got ${completeRes.statusCode}`);
    }

    const completedSched = await Schedule.findById(firstSched._id);
    if (completedSched.status !== 'completed' || completedSched.note !== 'Covered timeline editing concepts') {
      throw new Error(`Schedule completion status/note not saved: status=${completedSched.status}, note=${completedSched.note}`);
    }
    console.log('✅ Mark Complete action successfully updated database status and note.');

    // 3. Student dashboard timetable E2E
    console.log('\n👣 Verifying Student dashboard today schedule...');
    const studentCookie = await login('day7student@example.com');
    const studentDashboard = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/student/dashboard', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });

    if (!studentDashboard.data.includes('Editing Basic') || !studentDashboard.data.includes('Weekly Timetable Schedule')) {
      throw new Error('Student dashboard does not display today schedule or weekly timetable grid.');
    }
    console.log('✅ Student dashboard schedule and weekly timetable grid render correctly!');

    // 4. Classroom grid view E2E
    console.log('\n👣 Verifying Classroom Grid View page rendering...');
    const classroomGridRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/admin/schedules?view=classroom', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    if (!classroomGridRes.data.includes('Classroom-wise allocation grid') || !classroomGridRes.data.includes('Day7 Room A')) {
      throw new Error('Classroom Grid View page failed to load or missing classroom headers.');
    }
    console.log('✅ Classroom Grid View page loaded and rendered successfully!');

    console.log('\n🎉 ALL DAY 7 INTEGRATION CHECKS PASSED GREEN!');

  } catch (err) {
    console.error('❌ Day 7 Verification Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n🛑 Cleaning up test server and db connection...');
    serverProc.kill();
    await mongoose.disconnect();
    console.log('👋 Cleaned up. Exiting.');
  }
}

run();
