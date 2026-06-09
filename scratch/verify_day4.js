const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Lead = require('../models/Lead');

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
  console.log('🚀 Starting Verification for Day 4 Tasks...');
  
  // Start server on port 3131
  const env = { ...process.env, PORT: '3131', NODE_ENV: 'test' };
  const serverProc = spawn('node', ['server.js'], { cwd: process.cwd(), env });

  serverProc.stderr.on('data', (data) => {
    console.error(`[Server Err]: ${data.toString().trim()}`);
  });

  console.log('⏳ Waiting for server to spin up...');
  await sleep(4000);

  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
    
    // Seed a test lead if none exists
    let lead = await Lead.findOne({ email: 'day4testlead@example.com' });
    if (!lead) {
      lead = await Lead.create({
        name: 'Day 4 Test Lead',
        email: 'day4testlead@example.com',
        phone: '9876543210',
        course: 'Digital Marketing',
        status: 'ready_to_convert',
        assignedTo: new mongoose.Types.ObjectId()
      });
    }

    // 1. Log in as admin
    console.log('\n🔑 Logging in as Admin...');
    const adminLoginData = 'email=admin%40vandedigital.com&password=password123';
    const adminLoginRes = await makeRequest({
      hostname: 'localhost', port: 3131, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(adminLoginData) }
    }, adminLoginData);
    
    const adminCookie = getCookies(adminLoginRes.headers);
    console.log('✅ Admin logged in.');

    // 2. Convert lead as Admin with 3 custom installments
    console.log('\n💼 Converting lead as admin with custom installments...');
    const uniqueStudentEmail = `day4student_${Date.now()}@example.com`;
    const convertData = [
      'name=Day+4+Test+Lead',
      'phone=9876543210',
      `email=${encodeURIComponent(uniqueStudentEmail)}`,
      'password=password123',
      'course=Digital+Marketing',
      'batch=General+Batch',
      'fees_total=30000',
      'fees_paid=15000',
      'teacherId=' + new mongoose.Types.ObjectId(),
      'enrollmentDate=' + new Date().toISOString().split('T')[0],
      'instName%5B%5D=Installment+1',
      'instAmount%5B%5D=10000',
      'instDueDate%5B%5D=2026-07-01',
      'instName%5B%5D=Installment+2',
      'instAmount%5B%5D=10000',
      'instDueDate%5B%5D=2026-08-01',
      'instName%5B%5D=Installment+3',
      'instAmount%5B%5D=10000',
      'instDueDate%5B%5D=2026-09-01'
    ].join('&');

    const convertRes = await makeRequest({
      hostname: 'localhost', port: 3131, path: `/admin/leads/${lead._id}/convert`, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(convertData),
        'Cookie': adminCookie
      }
    }, convertData);

    if (convertRes.statusCode !== 302) {
      throw new Error(`Admin conversion failed with status ${convertRes.statusCode}: ${convertRes.data}`);
    }

    const redirectPath = convertRes.headers.location;
    console.log(`✅ Convert successful. Redirected to: ${redirectPath}`);
    if (!redirectPath.includes('/admin/students/')) {
      throw new Error(`Expected redirect to student profile page, got: ${redirectPath}`);
    }

    const studentId = redirectPath.split('/').pop();
    
    // Verify fee record custom installments in database
    const fee = await Fee.findOne({ student: studentId });
    if (!fee || fee.installments.length !== 3) {
      throw new Error(`Fee record installments length expected 3, got: ${fee ? fee.installments.length : 0}`);
    }
    console.log('✅ Fee record custom installments verified in database.');

    // 3. Log in as converted student and check dashboard / KYC / fee views
    console.log('\n🔑 Logging in as Student...');
    const studentLoginData = `email=${encodeURIComponent(uniqueStudentEmail)}&password=password123`;
    const studentLoginRes = await makeRequest({
      hostname: 'localhost', port: 3131, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(studentLoginData) }
    }, studentLoginData);
    
    const studentCookie = getCookies(studentLoginRes.headers);
    console.log('✅ Student logged in.');

    console.log('\n👣 Verifying student dashboard has complete profile KYC warning...');
    const studentDashRes = await makeRequest({
      hostname: 'localhost', port: 3131, path: '/student/dashboard', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });

    if (!studentDashRes.data.includes('Complete Your Profile') || !studentDashRes.data.includes('KYC Required')) {
      throw new Error('KYC banner not found on student dashboard');
    }
    console.log('✅ Student dashboard displays the KYC gate warning banner correctly.');

    console.log('\n👣 Verifying student curriculum access is blocked...');
    const curriculumRes = await makeRequest({
      hostname: 'localhost', port: 3131, path: '/student/curriculum', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });
    if (curriculumRes.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for curriculum access, got status: ${curriculumRes.statusCode}`);
    }
    console.log('✅ Student curriculum access blocked successfully.');

    console.log('\n👣 Verifying student assignments access is blocked...');
    const assignmentsRes = await makeRequest({
      hostname: 'localhost', port: 3131, path: '/student/assignments', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });
    if (assignmentsRes.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for assignments access, got status: ${assignmentsRes.statusCode}`);
    }
    console.log('✅ Student assignments access blocked successfully.');

    console.log('\n👣 Verifying student fee ledger displays the 3 installments...');
    const studentFeeRes = await makeRequest({
      hostname: 'localhost', port: 3131, path: '/student/fees', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });
    if (!studentFeeRes.data.includes('Installment 1') || !studentFeeRes.data.includes('Installment 2') || !studentFeeRes.data.includes('Installment 3')) {
      console.log('--- DEBUG studentFeeRes.data ---');
      console.log(studentFeeRes.data);
      console.log('Status code:', studentFeeRes.statusCode);
      throw new Error('Expected student fee ledger view to show custom installments.');
    }
    console.log('✅ Student fee ledger view displays installments correctly.');

    console.log('\n🎉 ALL DAY 4 INTEGRATION CHECKS PASSED GREEN!');

  } catch (err) {
    console.error('❌ Day 4 Verification Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n🛑 Cleaning up test server and db connection...');
    serverProc.kill();
    await mongoose.disconnect();
    console.log('👋 Cleaned up. Exiting.');
  }
}

run();
