const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Schedule = require('../models/Schedule');

// Helper to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for making requests
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

// Extract cookies from headers
function getCookies(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  return setCookie.map(c => c.split(';')[0]).join('; ');
}

async function run() {
  console.log('🚀 Starting Integration Verification for Timetable & Schedule Builder...');

  // Start the server in a separate process on port 3129
  const env = { ...process.env, PORT: '3129', NODE_ENV: 'development' };
  const serverProc = spawn('node', ['server.js'], { cwd: process.cwd(), env });

  serverProc.stdout.on('data', (data) => {
    // console.log(`[Server Out]: ${data.toString().trim()}`);
  });

  serverProc.stderr.on('data', (data) => {
    console.error(`[Server Err]: ${data.toString().trim()}`);
  });

  // Wait for the server to spin up
  console.log('⏳ Waiting for server to initialize...');
  await sleep(4000);

  let adminCookie = '';
  let teacherCookie = '';
  let studentCookie = '';
  let scheduleId = '';

  try {
    // Connect to DB directly
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');

    // Fetch teacher and student details
    const teacher = await User.findOne({ email: 'priya.teacher@gmail.com' });
    const student = await User.findOne({ email: 'vikram.student@gmail.com' });
    const Classroom = require('../models/Classroom');
    const classroom = await Classroom.findOne();

    if (!teacher || !student || !classroom) {
      throw new Error('Required test users or classrooms not found. Seed DB first.');
    }

    // Clean up any stale test schedules
    await Schedule.deleteMany({ subject: 'Integration Testing Schedule' });

    // 1. Log in as Admin
    console.log('\n🔑 Step 1: Logging in as Admin...');
    const adminLoginData = 'email=admin%40vandedigital.com&password=password123';
    const adminLoginRes = await makeRequest({
      hostname: 'localhost', port: 3129, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(adminLoginData) }
    }, adminLoginData);

    if (adminLoginRes.statusCode !== 302) {
      throw new Error(`Admin Login failed: status code ${adminLoginRes.statusCode}`);
    }
    adminCookie = getCookies(adminLoginRes.headers);
    console.log('✅ Admin logged in.');

    // 2. Load Schedules Listing Page
    console.log('\n📅 Step 2: Fetching Class Schedules Manager page...');
    const listPageRes = await makeRequest({
      hostname: 'localhost', port: 3129, path: '/admin/schedules', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    if (!listPageRes.data.includes('Class Schedules') || !listPageRes.data.includes('+ Add Schedule')) {
      throw new Error('Admin schedules listing page failed to load or missing button!');
    }
    console.log('✅ Class Schedules page loaded successfully.');

    // 3. Create Schedule Slot via POST
    console.log('\n✍️ Step 3: Admin creating a new Schedule slot...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const createPostData = `subject=Integration+Testing+Schedule&batch=DM-03PM-A1&teacher=${teacher._id}&classroom=${classroom._id}&date=${tomorrowStr}&startTime=11%3A00+AM&endTime=12%3A30+PM&status=scheduled`;
    const createRes = await makeRequest({
      hostname: 'localhost', port: 3129, path: '/admin/schedules/create', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(createPostData),
        'Cookie': adminCookie
      }
    }, createPostData);

    if (createRes.statusCode !== 302) {
      throw new Error(`Admin failed to create schedule: status code ${createRes.statusCode}`);
    }

    // Verify in database
    const createdSched = await Schedule.findOne({ subject: 'Integration Testing Schedule' });
    if (!createdSched) {
      throw new Error('Verification failed: Schedule record was not found in DB!');
    }
    scheduleId = createdSched._id.toString();
    console.log(`✅ Schedule created successfully. ID: ${scheduleId}`);

    // 4. Verify Schedule shows on Teacher Dashboard
    console.log('\n👩‍🏫 Step 4: Logging in as Teacher Priya Patel and verifying dashboard calendar...');
    const teacherLoginData = 'email=priya.teacher%40gmail.com&password=password123';
    const teacherLoginRes = await makeRequest({
      hostname: 'localhost', port: 3129, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(teacherLoginData) }
    }, teacherLoginData);

    if (teacherLoginRes.statusCode !== 302) {
      throw new Error(`Teacher Login failed: status code ${teacherLoginRes.statusCode}`);
    }
    teacherCookie = getCookies(teacherLoginRes.headers);

    const teacherDashRes = await makeRequest({
      hostname: 'localhost', port: 3129, path: '/teacher/dashboard', method: 'GET',
      headers: { 'Cookie': teacherCookie }
    });

    if (!teacherDashRes.data.includes('Integration Testing Schedule') || !teacherDashRes.data.includes('DM-03PM-A1')) {
      throw new Error('Teacher dashboard did not render the newly scheduled class!');
    }
    console.log('✅ Teacher dashboard shows schedule.');

    // 5. Verify Schedule shows on Student Dashboard
    console.log('\n👨‍🎓 Step 5: Logging in as Student Vikram Malhotra and verifying dashboard timetable...');
    const studentLoginData = 'email=vikram.student%40gmail.com&password=password123';
    const studentLoginRes = await makeRequest({
      hostname: 'localhost', port: 3129, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(studentLoginData) }
    }, studentLoginData);

    if (studentLoginRes.statusCode !== 302) {
      throw new Error(`Student Login failed: status code ${studentLoginRes.statusCode}`);
    }
    studentCookie = getCookies(studentLoginRes.headers);

    const studentDashRes = await makeRequest({
      hostname: 'localhost', port: 3129, path: '/student/dashboard', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });

    if (!studentDashRes.data.includes('Integration Testing Schedule') || !studentDashRes.data.includes('Weekly Timetable Schedule')) {
      console.log('DEBUG: studentDashRes status:', studentDashRes.statusCode);
      console.log('DEBUG: studentDashRes headers:', studentDashRes.headers);
      console.log('DEBUG: studentDashRes data snippet:', studentDashRes.data.slice(0, 1000));
      throw new Error('Student dashboard did not render the new timetable slot!');
    }
    console.log('✅ Student dashboard shows timetable slot.');

    // 6. Admin edit/update schedule slot
    console.log('\n🔧 Step 6: Admin updating schedule to completed...');
    const editPostData = `subject=Integration+Testing+Schedule&batch=DM-03PM-A1&teacher=${teacher._id}&classroom=${classroom._id}&date=${tomorrowStr}&startTime=11%3A00+AM&endTime=12%3A30+PM&status=completed`;
    const editRes = await makeRequest({
      hostname: 'localhost', port: 3129, path: `/admin/schedules/${scheduleId}/edit`, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(editPostData),
        'Cookie': adminCookie
      }
    }, editPostData);

    if (editRes.statusCode !== 302) {
      throw new Error(`Admin update schedule failed: status code ${editRes.statusCode}`);
    }

    const updatedSched = await Schedule.findById(scheduleId);
    if (updatedSched.status !== 'completed') {
      throw new Error(`Verification failed: Schedule status was not updated to completed! Got: ${updatedSched.status}`);
    }
    console.log('✅ Schedule updated successfully to completed.');

    // 7. Admin delete schedule slot
    console.log('\n🗑️ Step 7: Admin deleting schedule slot...');
    const deleteRes = await makeRequest({
      hostname: 'localhost', port: 3129, path: `/admin/schedules/${scheduleId}/delete`, method: 'POST',
      headers: { 'Cookie': adminCookie }
    });

    if (deleteRes.statusCode !== 302) {
      throw new Error(`Admin delete schedule failed: status code ${deleteRes.statusCode}`);
    }

    const deletedSched = await Schedule.findById(scheduleId);
    if (deletedSched) {
      throw new Error('Verification failed: Schedule record still exists in DB!');
    }
    console.log('✅ Schedule deleted successfully.');

    console.log('\n🎉 ALL CLASS TIMETABLE & SCHEDULE BUILDER TESTS PASSED SUCCESSFULLY! 👑');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('\n🛑 Shutting down test server...');
    serverProc.kill();
    await mongoose.disconnect();
    console.log('👋 Cleaned up. Exiting.');
  }
}

run();
