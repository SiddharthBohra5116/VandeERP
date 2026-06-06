const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');

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
  console.log('🚀 Starting Integration Verification for Smart Notifications & UX Upgrades...');

  // Start the server in a separate process on port 3125
  const env = { ...process.env, PORT: '3125', NODE_ENV: 'development' };
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

  let studentCookie = '';
  let adminCookie = '';

  try {
    // Connect to DB directly
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');

    // Fetch student to reset lastLoginAt
    const student = await User.findOne({ email: 'student@gmail.com' });
    if (!student) {
      throw new Error('Student seeder user student@gmail.com not found!');
    }
    student.lastLoginAt = null;
    await student.save();

    console.log(`📌 Target Student: ${student.name} (ID: ${student._id})`);

    // 1. Log in as Student and verify lastLoginAt updates
    console.log('\n🔑 Step 1: Logging in as Student...');
    const studentLoginData = `email=${encodeURIComponent(student.email)}&password=password123`;
    const studentLoginRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(studentLoginData) }
    }, studentLoginData);

    if (studentLoginRes.statusCode !== 302) {
      throw new Error(`Student Login failed: status code ${studentLoginRes.statusCode}`);
    }
    studentCookie = getCookies(studentLoginRes.headers);
    console.log('✅ Student logged in.');

    // Verify lastLoginAt updated in DB
    const studentAfterLogin = await User.findById(student._id);
    if (!studentAfterLogin.lastLoginAt) {
      throw new Error('Verification failed: lastLoginAt was not recorded on successful login!');
    }
    console.log(`✅ lastLoginAt verified in database: ${studentAfterLogin.lastLoginAt}`);

    // 2. Fetch Student Dashboard and check UX upgrades (greeting, clock, bell)
    console.log('\n📖 Step 2: Fetching student dashboard & checking UI components...');
    const studentDashRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/student/dashboard', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });

    if (studentDashRes.statusCode !== 200) {
      throw new Error(`Student Dashboard loaded with code: ${studentDashRes.statusCode}`);
    }

    // Verify Live Clock exists
    if (!studentDashRes.data.includes('id="liveClock"')) {
      throw new Error('Live Clock element is missing from topbar layout!');
    }
    console.log('✅ Live clock topbar container found.');

    // Verify Time-Aware Greeting banner exists
    if (!studentDashRes.data.includes('id="dashboardGreeting"')) {
      throw new Error('Time-aware dashboardGreeting element is missing!');
    }
    console.log('✅ Dashboard greeting container found.');

    // Verify Notification Dropdown Bell exists
    if (!studentDashRes.data.includes('id="notificationBellBtn"') || !studentDashRes.data.includes('id="notificationDropdown"')) {
      throw new Error('Notification Bell elements are missing from topbar layout!');
    }
    console.log('✅ Notification dropdown bell elements found.');

    // Verify Sidebar Collapse toggle button
    if (!studentDashRes.data.includes('id="menuToggleBtn"')) {
      throw new Error('Sidebar hamburger toggle button menuToggleBtn is missing!');
    }
    console.log('✅ Sidebar hamburger toggle button found.');

    // 3. Log in as Admin
    console.log('\n🔑 Step 3: Logging in as Admin...');
    const adminLoginData = 'email=admin%40vandedigital.com&password=password123';
    const adminLoginRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(adminLoginData) }
    }, adminLoginData);

    if (adminLoginRes.statusCode !== 302) {
      throw new Error(`Admin Login failed: status code ${adminLoginRes.statusCode}`);
    }
    adminCookie = getCookies(adminLoginRes.headers);
    console.log('✅ Admin logged in.');

    // 4. Fetch Admin Dashboard & Verify Clickable Stat Cards
    console.log('\n📖 Step 4: Fetching admin dashboard & checking Clickable Stat Cards...');
    const adminDashRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/admin/dashboard', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    if (!adminDashRes.data.includes('href="/admin/students"') || !adminDashRes.data.includes('href="/admin/teachers"') || !adminDashRes.data.includes('href="/admin/leads"')) {
      throw new Error('Admin stat cards are not wrapped in clickable anchors pointing to lists!');
    }
    console.log('✅ Clickable stat card anchors verified successfully.');

    // 5. Fetch Admin Users List and check Last Active Display
    console.log('\n📖 Step 5: Fetching users directory & verifying last active relative timestamp...');
    const usersRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/admin/users', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    if (!usersRes.data.includes('Active:')) {
      throw new Error('Active status timestamp text is missing from user list table!');
    }
    console.log('✅ Last active relative timestamp display found.');

    console.log('\n🎉 ALL NOTIFICATIONS & UX UPGRADES TESTS PASSED SUCCESSFULLY! 👑');

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
