require('dotenv').config();
const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');

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
  console.log('🌐 Starting Programmatic Browser QA Flow...');

  const User = require('../models/User');
  const Student = require('../models/Student');
  const Lead = require('../models/Lead');
  const Teacher = require('../models/Teacher');
  const Counsellor = require('../models/Counsellor');

  const env = { ...process.env, PORT: '3133', NODE_ENV: 'development' };
  const serverProc = spawn('node', ['server.js'], { cwd: process.cwd(), env });

  serverProc.stdout.on('data', (data) => {
    // Suppress verbose logs
  });

  serverProc.stderr.on('data', (data) => {
    console.error(`[Server Err]: ${data.toString().trim()}`);
  });

  console.log('⏳ Waiting for server to spin up on port 3133...');
  await sleep(4000);

  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande-academy');

    const nonDay8Users = await User.find({ email: { $not: /day8/ } }).select('_id');
    const userIds = nonDay8Users.map(u => u._id);

    const finalStudent = await Student.findOne({ user: { $in: userIds } }).populate('user');
    const finalTeacher = await Teacher.findOne({ user: { $in: userIds } }).populate('user');
    const finalCounsellor = await Counsellor.findOne({ user: { $in: userIds } }).populate('user');
    const sampleLead = await Lead.findOne({ name: { $not: /Day8/ } });

    if (!finalStudent || !sampleLead || !finalTeacher || !finalCounsellor) {
      throw new Error('Could not find seeded sample documents. Ensure you have run node seeder.js');
    }

    console.log(`\n📌 Using Sample Student ID: ${finalStudent._id} (${finalStudent.user.email})`);
    console.log(`📌 Using Sample Lead ID: ${sampleLead._id}`);
    console.log(`📌 Using Sample Teacher Profile ID: ${finalTeacher._id} (${finalTeacher.user.email})`);
    console.log(`📌 Using Sample Counsellor Profile ID: ${finalCounsellor._id} (${finalCounsellor.user.email})`);

    const studentId = finalStudent._id;
    const studentEmail = finalStudent.user.email;
    const teacherEmail = finalTeacher.user.email;
    const counsellorEmail = finalCounsellor.user.email;

    // ─────────────────────────────────────────────
    // 1. ADMIN FLOW
    // ─────────────────────────────────────────────
    console.log('\n🔑 Logging in as Admin...');
    const adminLoginData = JSON.stringify({ email: 'admin@vandeacademy.com', password: '123456' });
    const adminLoginRes = await makeRequest({
      hostname: 'localhost',
      port: 3133,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(adminLoginData)
      }
    }, adminLoginData);

    if (adminLoginRes.statusCode !== 200 && adminLoginRes.statusCode !== 302) {
      throw new Error(`Admin login failed with status ${adminLoginRes.statusCode}`);
    }
    const adminCookie = getCookies(adminLoginRes.headers);
    console.log('✅ Admin login successful.');

    const adminPages = [
      { name: 'Admin Dashboard', path: '/admin/dashboard' },
      { name: 'Student List', path: '/admin/students' },
      { name: 'Student Profile', path: `/admin/students/${studentId}` },
      { name: 'Fee Detail', path: `/admin/fees/${studentId}` },
      { name: 'Lead Detail', path: `/admin/leads/${sampleLead._id}` },
      { name: 'Convert Lead Form', path: `/admin/leads/${sampleLead._id}/convert` },
      { name: 'Attendance Page', path: '/admin/attendance' }
    ];

    for (const page of adminPages) {
      console.log(`👣 Fetching ${page.name} (${page.path})...`);
      const res = await makeRequest({
        hostname: 'localhost',
        port: 3133,
        path: page.path,
        method: 'GET',
        headers: { Cookie: adminCookie }
      });
      if (res.statusCode !== 200) {
        throw new Error(`Failed to load ${page.name}. Status code: ${res.statusCode}`);
      }
      console.log(`   ✅ ${page.name} loaded successfully (HTTP 200).`);
    }

    // ─────────────────────────────────────────────
    // 2. TEACHER FLOW
    // ─────────────────────────────────────────────
    console.log(`\n🔑 Logging in as Teacher (${teacherEmail})...`);
    const teacherLoginData = JSON.stringify({ email: teacherEmail, password: '123456' });
    const teacherLoginRes = await makeRequest({
      hostname: 'localhost',
      port: 3133,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(teacherLoginData)
      }
    }, teacherLoginData);

    if (teacherLoginRes.statusCode !== 200 && teacherLoginRes.statusCode !== 302) {
      throw new Error(`Teacher login failed with status ${teacherLoginRes.statusCode}`);
    }
    const teacherCookie = getCookies(teacherLoginRes.headers);
    console.log('✅ Teacher login successful.');

    console.log('👣 Fetching Teacher Dashboard (/teacher/dashboard)...');
    const teacherDashRes = await makeRequest({
      hostname: 'localhost',
      port: 3133,
      path: '/teacher/dashboard',
      method: 'GET',
      headers: { Cookie: teacherCookie }
    });
    if (teacherDashRes.statusCode !== 200) {
      throw new Error(`Failed to load Teacher Dashboard. Status code: ${teacherDashRes.statusCode}`);
    }
    console.log('   ✅ Teacher Dashboard loaded successfully (HTTP 200).');

    // ─────────────────────────────────────────────
    // 3. COUNSELLOR FLOW
    // ─────────────────────────────────────────────
    console.log(`\n🔑 Logging in as Counsellor (${counsellorEmail})...`);
    const counsellorLoginData = JSON.stringify({ email: counsellorEmail, password: '123456' });
    const counsellorLoginRes = await makeRequest({
      hostname: 'localhost',
      port: 3133,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(counsellorLoginData)
      }
    }, counsellorLoginData);

    if (counsellorLoginRes.statusCode !== 200 && counsellorLoginRes.statusCode !== 302) {
      throw new Error(`Counsellor login failed with status ${counsellorLoginRes.statusCode}`);
    }
    const counsellorCookie = getCookies(counsellorLoginRes.headers);
    console.log('✅ Counsellor login successful.');

    console.log('👣 Fetching Counsellor Dashboard (/counsellor/leads)...');
    const counsellorDashRes = await makeRequest({
      hostname: 'localhost',
      port: 3133,
      path: '/counsellor/leads',
      method: 'GET',
      headers: { Cookie: counsellorCookie }
    });
    if (counsellorDashRes.statusCode !== 200) {
      throw new Error(`Failed to load Counsellor Dashboard. Status code: ${counsellorDashRes.statusCode}`);
    }
    console.log('   ✅ Counsellor Dashboard loaded successfully (HTTP 200).');

    // ─────────────────────────────────────────────
    // 4. STUDENT FLOW
    // ─────────────────────────────────────────────
    console.log(`\n🔑 Logging in as Student (${studentEmail})...`);
    const studentLoginData = JSON.stringify({ email: studentEmail, password: '123456' });
    const studentLoginRes = await makeRequest({
      hostname: 'localhost',
      port: 3133,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(studentLoginData)
      }
    }, studentLoginData);

    if (studentLoginRes.statusCode !== 200 && studentLoginRes.statusCode !== 302) {
      throw new Error(`Student login failed with status ${studentLoginRes.statusCode}`);
    }
    const studentCookie = getCookies(studentLoginRes.headers);
    console.log('✅ Student login successful.');

    console.log('👣 Fetching Student Dashboard (/student/dashboard)...');
    const studentDashRes = await makeRequest({
      hostname: 'localhost',
      port: 3133,
      path: '/student/dashboard',
      method: 'GET',
      headers: { Cookie: studentCookie }
    });
    if (studentDashRes.statusCode !== 200) {
      throw new Error(`Failed to load Student Dashboard. Status code: ${studentDashRes.statusCode}`);
    }
    console.log('   ✅ Student Dashboard loaded successfully (HTTP 200).');

    console.log('\n🎉 ALL PROGRAMMATIC BROWSER QA FLOW CHECKS PASSED GREEN!');

  } catch (err) {
    console.error('\n❌ QA Flow failed:', err.message);
    process.exitCode = 1;
  } finally {
    console.log('\n🛑 Cleaning up test server and db connection...');
    await mongoose.disconnect();
    serverProc.kill();
    console.log('👋 Cleaned up. Exiting.');
    process.exit();
  }
}

run();
