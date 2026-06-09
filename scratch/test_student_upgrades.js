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

// Helper to build multipart body for mock file upload
function buildMultipartBody(boundary, fieldName, filename, fileContent, mimeType) {
  let body = Buffer.alloc(0);
  body = Buffer.concat([
    body,
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n`),
    Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`),
    fileContent,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  return body;
}

async function run() {
  console.log('🚀 Starting Integration Verification for Student Profile Upgrades...');

  // Start the server in a separate process on port 3130
  const env = { ...process.env, PORT: '3130', NODE_ENV: 'development' };
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
    // Connect to DB directly
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');

    // Fetch default student
    let student = await User.findOne({ email: 'vikram.student@gmail.com' });
    if (!student) {
      student = await User.findOne({ email: 'student@gmail.com' });
    }
    if (!student) {
      throw new Error('No student found in DB. Make sure seeder is run.');
    }
    studentId = student._id.toString();

    // Reset student profile fields for clean test
    student.idProof = null;
    student.idVerified = false;
    student.status = 'active';
    student.isActive = true;
    student.feedback = { submitted: false };
    student.remarks = [];
    student.statusHistory = [];
    await student.save();

    console.log(`📌 Target Student: ${student.name} (ID: ${studentId}, Batch: ${student.batch})`);

    // 1. Log in as Student
    console.log('\n🔑 Step 1: Logging in as Student...');
    const studentLoginData = `email=${encodeURIComponent(student.email)}&password=password123`;
    const studentLoginRes = await makeRequest({
      hostname: 'localhost', port: 3130, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(studentLoginData) }
    }, studentLoginData);

    if (studentLoginRes.statusCode !== 302) {
      throw new Error(`Student Login failed: status code ${studentLoginRes.statusCode}`);
    }
    studentCookie = getCookies(studentLoginRes.headers);
    console.log('✅ Student logged in.');

    // 2. Upload ID Proof as Student
    console.log('\n📤 Step 2: Uploading ID proof document as student...');
    const boundary = '----WebKitFormBoundaryEJSVerificationTest';
    const dummyFileContent = Buffer.from('MOCK_IMAGE_DATA_AADHAAR');
    const uploadBody = buildMultipartBody(boundary, 'idProof', 'aadhaar.png', dummyFileContent, 'image/png');

    const uploadRes = await makeRequest({
      hostname: 'localhost', port: 3130, path: '/student/profile/upload-id', method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': uploadBody.length,
        'Cookie': studentCookie
      }
    }, uploadBody);

    if (uploadRes.statusCode !== 302) {
      throw new Error(`ID upload failed: status code ${uploadRes.statusCode}`);
    }

    // Verify upload in DB
    const studentAfterUpload = await User.findById(studentId);
    if (!studentAfterUpload.idProof || studentAfterUpload.idVerified) {
      throw new Error('Verification failed: ID proof path was not written or verified was true!');
    }
    console.log(`✅ ID proof uploaded successfully. Path: ${studentAfterUpload.idProof}`);

    // 3. Log in as Admin and Verify ID Proof
    console.log('\n🔑 Step 3: Logging in as Admin & verifying student ID proof...');
    const adminLoginData = 'email=admin%40vandedigital.com&password=password123';
    const adminLoginRes = await makeRequest({
      hostname: 'localhost', port: 3130, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(adminLoginData) }
    }, adminLoginData);

    if (adminLoginRes.statusCode !== 302) {
      throw new Error(`Admin Login failed: status code ${adminLoginRes.statusCode}`);
    }
    adminCookie = getCookies(adminLoginRes.headers);

    // Verify ID POST
    const verifyRes = await makeRequest({
      hostname: 'localhost', port: 3130, path: `/admin/students/${studentId}/verify-id`, method: 'POST',
      headers: { 'Cookie': adminCookie }
    });

    if (verifyRes.statusCode !== 302) {
      throw new Error(`Admin verify ID failed: status code ${verifyRes.statusCode}`);
    }

    const studentAfterVerify = await User.findById(studentId);
    if (!studentAfterVerify.idVerified) {
      throw new Error('Verification failed: idVerified flag is still false!');
    }
    console.log('✅ Student ID verified successfully by Admin.');

    // 4. Admin leaves a remark
    console.log('\n✍️ Step 4: Admin posting remark note on student profile...');
    const remarkNote = 'Excellent progress on class project work. Needs to focus on DaVinci Resolve color panels next.';
    const remarkPostData = `note=${encodeURIComponent(remarkNote)}`;
    const remarkRes = await makeRequest({
      hostname: 'localhost', port: 3130, path: `/admin/students/${studentId}/remark`, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(remarkPostData),
        'Cookie': adminCookie
      }
    }, remarkPostData);

    if (remarkRes.statusCode !== 302) {
      throw new Error(`Admin failed to post remark: status code ${remarkRes.statusCode}`);
    }

    // Verify in DB
    const studentAfterRemark = await User.findById(studentId);
    const hasRemark = studentAfterRemark.remarks.find(r => r.note === remarkNote);
    if (!hasRemark) {
      throw new Error('Verification failed: Remark note was not found on student profile schema!');
    }
    console.log('✅ Remark note successfully written to Student remarks list.');

    // Fetch Student Dashboard and verify it displays the remark
    const studentDashRes1 = await makeRequest({
      hostname: 'localhost', port: 3130, path: '/student/dashboard', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });

    if (!studentDashRes1.data.includes('Academy Faculty &amp; Staff Remarks') && !studentDashRes1.data.includes('Academy Faculty & Staff Remarks')) {
      throw new Error('Student dashboard did not display the Remarks Timeline card!');
    }
    if (!studentDashRes1.data.includes(remarkNote)) {
      throw new Error('Student dashboard Remarks Timeline did not display the Admin remark text!');
    }
    console.log('✅ Student dashboard successfully renders staff remarks timeline.');

    // 5. Admin updates Student Status to "complete"
    console.log('\n🎓 Step 5: Admin changing student status to "complete" with history reason...');
    const statusReason = 'Successfully completed term assignments and project evaluations.';
    const statusPostData = `status=complete&reason=${encodeURIComponent(statusReason)}`;
    const statusRes = await makeRequest({
      hostname: 'localhost', port: 3130, path: `/admin/students/${studentId}/status`, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(statusPostData),
        'Cookie': adminCookie
      }
    }, statusPostData);

    if (statusRes.statusCode !== 302) {
      throw new Error(`Admin failed to update status: status code ${statusRes.statusCode}`);
    }

    // Verify status and history in DB
    const studentAfterStatus = await User.findById(studentId);
    if (studentAfterStatus.status !== 'complete' || studentAfterStatus.isActive) {
      throw new Error(`Verification failed: Status was not complete or isActive was true! status: ${studentAfterStatus.status}, active: ${studentAfterStatus.isActive}`);
    }
    const hasHistory = studentAfterStatus.statusHistory.find(h => h.status === 'complete' && h.reason === statusReason);
    if (!hasHistory) {
      throw new Error('Verification failed: Status history logs are missing the completed state entry!');
    }
    console.log('✅ Status updated to complete and logged in status history.');

    // 6. Student Dashboard Intercept
    console.log('\n🛑 Step 6: Verifying Student Dashboard is blocked by Feedback Questionnaire...');
    const studentDashBlockedRes = await makeRequest({
      hostname: 'localhost', port: 3130, path: '/student/dashboard', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });

    if (!studentDashBlockedRes.data.includes('Course Completion Feedback') || !studentDashBlockedRes.data.includes('teacherRating')) {
      throw new Error('Student dashboard failed to block access; feedback form not found!');
    }
    console.log('✅ Access blocked. Feedback form is successfully intercepted.');

    // 7. Student submits Feedback Questionnaire
    console.log('\n✍️ Step 7: Submitting completed feedback questionnaire form...');
    const feedbackPostData = 'teacherRating=5&contentRating=4&facilitiesRating=5&comments=Absolutely+loved+the+premiere+faculties+and+project-based+learning.';
    const feedbackRes = await makeRequest({
      hostname: 'localhost', port: 3130, path: '/student/feedback', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(feedbackPostData),
        'Cookie': studentCookie
      }
    }, feedbackPostData);

    if (feedbackRes.statusCode !== 302) {
      throw new Error(`Feedback submission failed: status code ${feedbackRes.statusCode}`);
    }

    // Verify feedback values in DB
    const studentAfterFeedback = await User.findById(studentId);
    if (!studentAfterFeedback.feedback.submitted || studentAfterFeedback.feedback.teacherRating !== 5 || studentAfterFeedback.feedback.comments !== 'Absolutely loved the premiere faculties and project-based learning.') {
      throw new Error('Verification failed: Feedback record did not save correctly!');
    }
    console.log('✅ Feedback successfully stored in student record.');

    // 8. Verify Dashboard is unblocked after submission
    console.log('\n🔓 Step 8: Verifying student dashboard loads normally after feedback submission...');
    const studentDashOpenRes = await makeRequest({
      hostname: 'localhost', port: 3130, path: '/student/dashboard', method: 'GET',
      headers: { 'Cookie': studentCookie }
    });

    if (studentDashOpenRes.data.includes('Course Completion Feedback') && studentDashOpenRes.data.includes('Submit Feedback')) {
      throw new Error('Student dashboard is still blocked by feedback form even after submitting!');
    }
    if (!studentDashOpenRes.data.includes('My Dashboard') || !studentDashOpenRes.data.includes('Attendance Rate')) {
      throw new Error('Student dashboard failed to render stats and dashboard info!');
    }
    console.log('✅ Dashboard loaded successfully.');

    // 9. Admin view displays feedback details
    console.log('\n📊 Step 9: Verifying Admin student profile tab displays feedback results...');
    const adminProfileRes = await makeRequest({
      hostname: 'localhost', port: 3130, path: `/admin/students/${studentId}`, method: 'GET',
      headers: { 'Cookie': adminCookie }
    });

    if (!adminProfileRes.data.includes('Absolutely loved the premiere faculties')) {
      throw new Error('Admin profile did not display the student feedback comments!');
    }
    console.log('✅ Admin student profile tab successfully displays feedback results.');

    console.log('\n🎉 ALL STUDENT PROFILE UPGRADES TESTS PASSED SUCCESSFULLY! 👑');

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
