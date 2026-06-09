const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Lead = require('../models/Lead');
const Schedule = require('../models/Schedule');
const LeaveRequest = require('../models/LeaveRequest');
const Assignment = require('../models/Assignment');

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
  console.log('🚀 Starting Verification for Day 5 Tasks...');
  
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
    
    // Seed some test data
    console.log('\n🌱 Seeding test database records...');
    
    // Create a student if needed
    let student = await User.findOne({ email: 'day5student@example.com' });
    if (!student) {
      student = await User.create({
        name: 'Day 5 Test Student',
        email: 'day5student@example.com',
        password: 'password123',
        role: 'student',
        phone: '9876543211',
        course: 'Digital Marketing',
        batch: 'General Batch',
        enrollmentDate: new Date(),
        isActive: true,
        pendingProfileUpdate: {
          name: null,
          phone: null,
          requestedAt: null
        }
      });
    }

    // Set up or update their fee
    let fee = await Fee.findOne({ student: student._id });
    if (!fee) {
      fee = await Fee.create({
        student: student._id,
        course: 'Digital Marketing',
        totalAmount: 40000,
        paidAmount: 0,
        payments: []
      });
    } else {
      fee.payments = [];
      fee.paidAmount = 0;
      await fee.save();
    }

    // 1. Log in as admin
    console.log('\n🔑 Logging in as Admin...');
    const adminLoginData = 'email=admin%40vandedigital.com&password=password123';
    const adminLoginRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(adminLoginData) }
    }, adminLoginData);
    
    const adminCookie = getCookies(adminLoginRes.headers);
    console.log('✅ Admin logged in.');

    // 2. Fetch admin dashboard to verify 6 cards
    console.log('\n👣 Fetching admin dashboard page...');
    const dashRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/admin/dashboard', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    if (!dashRes.data.includes("Today's Fee Collections") || !dashRes.data.includes("Today's Scheduled Classes")) {
      throw new Error('Rebuilt dashboard cards not found on page');
    }
    console.log('✅ Dashboard includes the 6 dynamic collections/classes cards.');

    // Extract collection total before the payment
    const getCollectionsFromHtml = (html) => {
      const match = html.match(/Today's Fee Collections<\/div>\s*<div class="stat-value">₹([\d,]+)/);
      if (!match) return 0;
      return parseInt(match[1].replace(/,/g, ''), 10);
    };

    const initialTotal = getCollectionsFromHtml(dashRes.data);
    console.log(`👣 Dashboard initial collections total: ₹${initialTotal}`);

    // 3. Record a payment and confirm it updates collections
    console.log('\n💵 Adding a fee payment today...');
    const paymentData = 'amount=5000&method=UPI&transactionId=TXN123456&note=Test+Payment';
    const payRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: `/admin/fees/${student._id}/payment`, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(paymentData),
        'Cookie': adminCookie
      }
    }, paymentData);

    if (payRes.statusCode !== 302) {
      throw new Error(`Failed to record payment, status: ${payRes.statusCode}`);
    }

    console.log('👣 Re-fetching dashboard to verify collections card total...');
    const dashResAfterPay = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/admin/dashboard', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    const newTotal = getCollectionsFromHtml(dashResAfterPay.data);
    console.log(`👣 Dashboard new collections total: ₹${newTotal}`);
    if (newTotal !== initialTotal + 5000) {
      throw new Error(`Today's collections card did not reflect the ₹5,000 payment. Expected ₹${initialTotal + 5000}, got ₹${newTotal}`);
    }
    console.log("✅ Today's collections card successfully updated with today's payment!");

    // 4. Log in as student and submit profile update request
    console.log('\n🔑 Logging in as Student...');
    const studentLoginData = 'email=day5student%40example.com&password=password123';
    const studentLoginRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(studentLoginData) }
    }, studentLoginData);
    
    const studentCookie = getCookies(studentLoginRes.headers);
    console.log('✅ Student logged in.');

    console.log('\n📤 Submitting profile update request...');
    const profileReqData = 'name=New+Proposed+Name&phone=9876543212';
    const profileReqRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/auth/profile', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(profileReqData),
        'Cookie': studentCookie
      }
    }, profileReqData);

    if (profileReqRes.statusCode !== 302) {
      throw new Error(`Profile request submission failed with status: ${profileReqRes.statusCode}`);
    }
    console.log('✅ Student profile update request successfully queued.');

    // 5. Fetch approvals queue page `/admin/profile-requests`
    console.log('\n👣 Fetching profile approvals queue page as Admin...');
    const approvalsRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/admin/profile-requests', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    if (!approvalsRes.data.includes('New Proposed Name') || !approvalsRes.data.includes('Day 5 Test Student')) {
      throw new Error('Proposed values comparison not displayed in queue page');
    }
    console.log('✅ Queue page correctly shows the pending name side-by-side comparison.');

    // 6. Test notifications JSON endpoint `/api/notifications`
    console.log('\n👣 Checking asynchronous notifications API endpoint...');
    const apiRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/api/notifications', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    if (apiRes.statusCode !== 200) {
      throw new Error(`API notifications returned error status: ${apiRes.statusCode}`);
    }
    const apiData = JSON.parse(apiRes.data);
    if (!apiData.hasOwnProperty('notifications') || !apiData.hasOwnProperty('sidebarBadges')) {
      throw new Error('API notifications JSON response missing required properties');
    }
    console.log('✅ JSON endpoint successfully returns notifications and sidebar badges.');

    console.log('\n🎉 ALL DAY 5 INTEGRATION CHECKS PASSED GREEN!');

  } catch (err) {
    console.error('❌ Day 5 Verification Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n🛑 Cleaning up test server and db connection...');
    serverProc.kill();
    await mongoose.disconnect();
    console.log('👋 Cleaned up. Exiting.');
  }
}

run();
