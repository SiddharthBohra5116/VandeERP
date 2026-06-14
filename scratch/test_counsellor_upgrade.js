const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Fee = require('../models/Fee');
const Student = require('../models/Student');

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
  console.log('🚀 Starting Integration Verification for Counsellor Dashboard Upgrade...');

  // Start the server in a separate process on port 3124
  const env = { ...process.env, PORT: '3124', NODE_ENV: 'development' };
  const serverProc = spawn('node', ['server.js'], { cwd: process.cwd(), env });

  serverProc.stdout.on('data', (data) => {
    console.log(`[Server Out]: ${data.toString().trim()}`);
  });

  serverProc.stderr.on('data', (data) => {
    console.error(`[Server Err]: ${data.toString().trim()}`);
  });

  // Wait for the server to spin up
  console.log('⏳ Waiting for server to initialize...');
  await sleep(4000);

  let cookie = '';
  let leadId = '';
  let deleteLeadId = '';

  try {
    // Connect to DB directly
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');

    // Clean up student user if already exists from a previous run
    await User.deleteMany({ email: { $in: ['vikram.student@gmail.com', 'vikram.student@vandedigital.com'] } });
    
    // Reset Vikram Malhotra lead status to 'interested'
    await Lead.updateOne({ name: 'Vikram Malhotra' }, { $set: { status: 'interested', convertedStudent: null } });

    // 1. Log in as Counsellor
    console.log('\n🔑 Step 1: Logging in as Counsellor...');
    const loginData = 'email=counsellor%40gmail.com&password=password123';
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 3124,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);

    if (loginRes.statusCode !== 302) {
      throw new Error(`Login failed: status code ${loginRes.statusCode}`);
    }
    cookie = getCookies(loginRes.headers);
    console.log('✅ Counsellor logged in. Cookie retrieved.');

    // Find Vikram Malhotra to test conversion
    const targetLead = await Lead.findOne({ name: 'Vikram Malhotra' });
    if (!targetLead) {
      throw new Error('Vikram Malhotra not found in DB. Make sure you seeded the DB.');
    }
    leadId = targetLead._id.toString();

    // Create a dummy lead to test deletion
    const counsellorUser = await User.findOne({ email: 'counsellor@gmail.com' });
    const dummyLead = await Lead.create({
      name: 'Trash Lead',
      phone: '1111111111',
      course: 'Undecided',
      source: 'Other',
      status: 'new',
      assignedTo: counsellorUser._id
    });
    deleteLeadId = dummyLead._id.toString();
    console.log(`📌 Target Lead for Conversion: ${targetLead.name} (ID: ${leadId})`);
    console.log(`📌 Target Lead for Deletion: ${dummyLead.name} (ID: ${deleteLeadId})`);

    // 2. Verify Dashboard Renders with Layout 'main' (e.g. check font family tags, Syne, sidebar, etc.)
    console.log('\n📊 Step 2: Fetching Counsellor Dashboard & verifying layouts...');
    const dashRes = await makeRequest({
      hostname: 'localhost',
      port: 3124,
      path: '/counsellor/dashboard',
      method: 'GET',
      headers: { 'Cookie': cookie }
    });

    if (dashRes.statusCode !== 200) {
      throw new Error(`Dashboard failed to load: ${dashRes.statusCode}`);
    }
    
    // Check that it doesn't contain counsellor-specific styles or custom layouts anymore
    if (dashRes.data.includes('/* ── VANDE DIGITAL DESIGN SYSTEM ── */') || dashRes.data.includes('--accent:    #f97316;')) {
      throw new Error('Layout verification failed: Custom orange stylesheet block still found in dashboard output!');
    }
    
    // Verify main style sheet is loaded
    if (!dashRes.data.includes('href="/css/main.css"')) {
      throw new Error('Layout verification failed: Main CSS stylesheet link missing!');
    }
    
    // Check sidebar links are present
    if (!dashRes.data.includes('counsellor portal') && !dashRes.data.includes('counsellor')) {
      throw new Error('Sidebar verification failed: role-badge "counsellor portal" not found in sidebar!');
    }
    console.log('✅ Dashboard loaded successfully using unified layout.');

    // 3. Test Lead Deletion
    console.log('\n🗑️ Step 3: Deleting Trash Lead via DELETE route...');
    const deleteRes = await makeRequest({
      hostname: 'localhost',
      port: 3124,
      path: `/counsellor/leads/${deleteLeadId}?_method=DELETE`,
      method: 'POST',
      headers: { 'Cookie': cookie }
    });

    if (deleteRes.statusCode !== 302) {
      throw new Error(`Delete request failed: ${deleteRes.statusCode}`);
    }

    const checkDeleted = await Lead.findById(deleteLeadId);
    if (checkDeleted) {
      throw new Error('Verification failed: Dummy lead was not deleted from DB!');
    }
    console.log('✅ Lead deleted successfully from database.');

    // 4. Test Lead Conversion Form
    console.log('\n🚶 Step 4: Loading Conversion Form...');
    const convertFormRes = await makeRequest({
      hostname: 'localhost',
      port: 3124,
      path: `/counsellor/leads/${leadId}/convert`,
      method: 'GET',
      headers: { 'Cookie': cookie }
    });

    if (convertFormRes.statusCode !== 200) {
      throw new Error(`Convert form failed to load: ${convertFormRes.statusCode}`);
    }
    if (!convertFormRes.data.includes('Confirm & Enroll Student') || !convertFormRes.data.includes('class="form-control"')) {
      throw new Error('Conversion form EJS check failed: missing form inputs or submit button!');
    }
    console.log('✅ Conversion form loaded and formatted correctly.');

    // 5. Submit Lead Conversion
    console.log('\n💼 Step 5: Submitting Lead Conversion (creating student & ledger)...');
    const convertPostData = `name=Vikram+Malhotra&phone=9090909000&email=vikram.student%40gmail.com&password=password123&course=Digital+Marketing&batch=DM-03PM-A1&fees_total=25000&fees_paid=12500&enrollmentDate=2026-06-04`;
    const convertRes = await makeRequest({
      hostname: 'localhost',
      port: 3124,
      path: `/counsellor/leads/${leadId}/convert`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(convertPostData),
        'Cookie': cookie
      }
    }, convertPostData);

    if (convertRes.statusCode !== 302) {
      throw new Error(`Conversion POST failed: status ${convertRes.statusCode}`);
    }
    console.log('✅ Conversion POST processed. Redirected.');

    // 6. Verify student account creation & roll number generation
    const studentUser = await User.findOne({ email: 'vikram.student@gmail.com' });
    if (!studentUser) {
      throw new Error('Verification failed: Student user was not created in DB!');
    }
    const studentProfile = await Student.findOne({ userId: studentUser._id });
    if (!studentProfile) {
      throw new Error('Verification failed: Student profile was not created in DB!');
    }
    console.log(`✅ Student created successfully. Roll Number: ${studentProfile.rollNumber}`);

    // 7. Verify Fee Ledger creation
    const feeLedger = await Fee.findOne({ student: studentProfile._id });
    if (!feeLedger) {
      throw new Error('Verification failed: Fee record was not created for the new student!');
    }
    if (feeLedger.paidAmount !== 12500 || feeLedger.totalAmount !== 25000) {
      throw new Error(`Verification failed: Fee amounts mismatch! Expected total 25000/paid 12500, got total ${feeLedger.totalAmount}/paid ${feeLedger.paidAmount}`);
    }
    console.log(`✅ Fee ledger matches inputs: Total = ₹${feeLedger.totalAmount}, Paid = ₹${feeLedger.paidAmount}`);

    // 8. Verify Lead status is set to admission_completed
    const updatedLead = await Lead.findById(leadId);
    if (updatedLead.status !== 'admission_completed' || updatedLead.convertedStudent.toString() !== studentProfile._id.toString()) {
      throw new Error(`Verification failed: Lead status not converted or mismatch! Status: ${updatedLead.status}`);
    }
    console.log('✅ Lead pipeline file marked as converted and linked to student record.');

    console.log('\n🎉 ALL COUNSELLOR UPGRADE INTEGRATION TESTS PASSED SUCCESSFULLY! 👑');

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
