const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');

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
  console.log('🚀 Starting Integration Verification for Notification Loop and Admin Sections...');

  // Start the server in a separate process on port 3126
  const env = { ...process.env, PORT: '3126', NODE_ENV: 'development' };
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
  let studentCookie = '';
  let studentId = '';

  try {
    // Connect to DB directly to fetch our target student ID for Vikram Malhotra
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
    const studentUser = await User.findOne({ email: 'vikram.student@gmail.com' });
    if (!studentUser) {
      throw new Error('Vikram Malhotra student not found in database. Make sure you seeded the DB.');
    }
    studentId = studentUser._id.toString();
    console.log(`📌 Found Student: Vikram Malhotra (ID: ${studentId})`);

    // 1. Log in as Admin
    console.log('\n🔑 Step 1: Logging in as Admin...');
    const adminLoginData = 'email=admin%40vandedigital.com&password=password123';
    const adminLoginRes = await makeRequest({
      hostname: 'localhost', port: 3126, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(adminLoginData) }
    }, adminLoginData);

    if (adminLoginRes.statusCode !== 302) {
      throw new Error(`Admin Login failed: status code ${adminLoginRes.statusCode}`);
    }
    adminCookie = getCookies(adminLoginRes.headers);
    console.log('✅ Admin logged in. Cookie retrieved.');

    // 2. Verify Manage Students Page
    console.log('\n👑 Step 2: Verifying Manage Students Page...');
    const studentPageRes = await makeRequest({
      hostname: 'localhost', port: 3126, path: '/admin/students', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });
    if (!studentPageRes.data.includes('Manage Students')) {
      throw new Error('Manage Students page failed to render the correct title!');
    }
    if (!studentPageRes.data.includes('Vikram Malhotra')) {
      throw new Error('Manage Students page missing target student Vikram Malhotra!');
    }
    console.log('✅ Manage Students page is healthy.');

    // 3. Verify Manage Teachers Page
    console.log('\n👑 Step 3: Verifying Manage Teachers Page...');
    const teacherPageRes = await makeRequest({
      hostname: 'localhost', port: 3126, path: '/admin/teachers', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });
    if (!teacherPageRes.data.includes('Manage Teachers')) {
      throw new Error('Manage Teachers page failed to render the correct title!');
    }
    if (!teacherPageRes.data.includes('Rohan Sharma')) {
      throw new Error('Manage Teachers page missing target teacher Rohan Sharma!');
    }
    console.log('✅ Manage Teachers page is healthy.');

    // 4. Verify Manage Counsellors Page
    console.log('\n👑 Step 4: Verifying Manage Counsellors Page...');
    const counsellorPageRes = await makeRequest({
      hostname: 'localhost', port: 3126, path: '/admin/counsellors', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });
    if (!counsellorPageRes.data.includes('Manage Counsellors')) {
      throw new Error('Manage Counsellors page failed to render the correct title!');
    }
    if (!counsellorPageRes.data.includes('Anjali Verma')) {
      throw new Error('Manage Counsellors page missing target counsellor Anjali Verma!');
    }
    console.log('✅ Manage Counsellors page is healthy.');

    // Clear previous test messages to keep results predictable
    await Message.deleteMany({ recipient: studentUser._id });

    // 5. Admin sends a message note to Vikram
    console.log('\n👑 Step 5: Admin sending message note to Vikram...');
    const testMessageContent = 'Hello Vikram, this is a test notification from the administrator regarding your upcoming evaluation.';
    const sendMsgData = `recipientId=${studentId}&content=${encodeURIComponent(testMessageContent)}&redirect=/admin/students/${studentId}`;
    const sendMsgRes = await makeRequest({
      hostname: 'localhost', port: 3126, path: '/admin/messages/send', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(sendMsgData),
        'Cookie': adminCookie
      }
    }, sendMsgData);

    if (sendMsgRes.statusCode !== 302) {
      throw new Error(`Admin failed to post message: ${sendMsgRes.statusCode}`);
    }
    console.log('✅ Message note sent by Admin.');

    // 6. Log in as Vikram
    console.log('\n🔑 Step 6: Logging in as Student Vikram Malhotra...');
    const studentLoginData = 'email=vikram.student%40gmail.com&password=password123';
    const studentLoginRes = await makeRequest({
      hostname: 'localhost', port: 3126, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(studentLoginData) }
    }, studentLoginData);

    if (studentLoginRes.statusCode !== 302) {
      throw new Error(`Student Login failed: status code ${studentLoginRes.statusCode}`);
    }
    studentCookie = getCookies(studentLoginRes.headers);
    console.log('✅ Student logged in.');

    // 7. Verify message note display on Student Dashboard
    console.log('\n📖 Step 7: Verifying dashboard notification rendering for Student...');
    const dashboardRes = await makeRequest({
      hostname: 'localhost', port: 3126, path: '/student/dashboard', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });

    if (!dashboardRes.data.includes('Direct Messages & Notifications')) {
      throw new Error('Student dashboard missing "Direct Messages & Notifications" card header!');
    }
    if (!dashboardRes.data.includes(testMessageContent)) {
      throw new Error('Student dashboard did not display the message sent by Admin!');
    }
    console.log('✅ Student dashboard successfully renders notifications.');

    // 8. Student sends message note back to Admin
    console.log('\n📖 Step 8: Student sending message query note back to Admin...');
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      throw new Error('Admin user not found in database.');
    }
    const adminId = adminUser._id.toString();

    // Clear previous incoming messages for Admin to keep results clean
    await Message.deleteMany({ recipient: adminUser._id });

    const replyMessageContent = 'Hello Admin, thank you for the update. I am ready for the evaluation.';
    const replyMsgData = `recipientId=${adminId}&content=${encodeURIComponent(replyMessageContent)}&redirect=/student/dashboard`;
    const replyMsgRes = await makeRequest({
      hostname: 'localhost', port: 3126, path: '/student/messages/send', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(replyMsgData),
        'Cookie': studentCookie
      }
    }, replyMsgData);

    if (replyMsgRes.statusCode !== 302) {
      throw new Error(`Student failed to send message note: ${replyMsgRes.statusCode}`);
    }
    console.log('✅ Reply message note sent by Student.');

    // 9. Admin Dashboard incoming messages display verification
    console.log('\n👑 Step 9: Verifying incoming messages displaying on Admin Dashboard...');
    const adminDashboardRes = await makeRequest({
      hostname: 'localhost', port: 3126, path: '/admin/dashboard', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    if (!adminDashboardRes.data.includes('Incoming Student & Staff Messages')) {
      throw new Error('Admin dashboard missing "Incoming Student & Staff Messages" card header!');
    }
    if (!adminDashboardRes.data.includes(replyMessageContent)) {
      throw new Error('Admin dashboard did not display the reply message sent by Student!');
    }
    console.log('✅ Admin dashboard successfully renders incoming messages.');

    console.log('\n🎉 ALL NOTIFICATION & SECTION UPGRADE TESTS PASSED SUCCESSFULLY! 👑');

  } catch (error) {
    console.error('\n❌ NOTIFICATION LOOP TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('\n🛑 Shutting down test server...');
    serverProc.kill();
    await mongoose.disconnect();
    console.log('👋 Cleaned up. Exiting.');
  }
}

run();
