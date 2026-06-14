const { spawn } = require('child_process');
const http = require('http');

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
  console.log('🚀 Starting Integration Verification for Multi-Role Search Capabilities...');

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

  try {
    // 1. Verify Teacher student search
    console.log('\n🔑 Step 1: Logging in as Teacher and searching students...');
    const teacherLogin = 'email=vikram.teacher%40gmail.com&password=password123';
    const teacherLoginRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(teacherLogin) }
    }, teacherLogin);
    const teacherCookie = getCookies(teacherLoginRes.headers);

    // Search for student "Kiara"
    const searchTeacherRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/teacher/students?search=Kiara', method: 'GET',
      headers: { 'Cookie': teacherCookie }
    });
    if (!searchTeacherRes.data.includes('Kiara Sen')) {
      throw new Error('Teacher search failed: Kiara Sen not found in search results!');
    }
    if (searchTeacherRes.data.includes('Aarav Mehta')) {
      throw new Error('Teacher search filtering failed: Aarav Mehta should have been filtered out!');
    }
    console.log('✅ Teacher student name search works perfectly.');

    // 2. Verify Admin Fees student search
    console.log('\n🔑 Step 2: Logging in as Admin and searching fees ledger...');
    const adminLogin = 'email=admin%40vandedigital.com&password=password123';
    const adminLoginRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(adminLogin) }
    }, adminLogin);
    const adminCookie = getCookies(adminLoginRes.headers);

    function getResultsHtml(body) {
      const start = body.indexOf('id="results-container"');
      const end = body.indexOf('/js/instant-filter.js');
      if (start !== -1 && end !== -1) {
        return body.substring(start, end);
      }
      return body;
    }

    const searchFeesRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/admin/fees?search=Siddharth', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });
    const feesResults = getResultsHtml(searchFeesRes.data);
    if (!feesResults.includes('Siddharth Patel')) {
      throw new Error('Admin Fees search failed: Siddharth Patel not found in search results!');
    }
    if (feesResults.includes('Aarav Mehta')) {
      throw new Error('Admin Fees filtering failed: Aarav Mehta should have been filtered out!');
    }
    console.log('✅ Admin Fees student name search works perfectly.');

    // 3. Verify Admin Leads search
    console.log('\n🔑 Step 3: Admin searching leads pipeline...');
    const searchLeadsRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/admin/leads?search=Pooja', method: 'GET',
      headers: { 'Cookie': adminCookie }
    });
    if (!searchLeadsRes.data.includes('Pooja Sharma')) {
      throw new Error('Admin Leads search failed: Pooja Sharma not found in search results!');
    }
    if (searchLeadsRes.data.includes('Vikram Malhotra')) {
      throw new Error('Admin Leads filtering failed: Vikram Malhotra should have been filtered out!');
    }
    console.log('✅ Admin Leads search works perfectly.');

    // 4. Verify Counsellor admissions search
    console.log('\n🔑 Step 4: Logging in as Counsellor and searching admitted roster...');
    const counsellorLogin = 'email=counsellor%40gmail.com&password=password123';
    const counsellorLoginRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(counsellorLogin) }
    }, counsellorLogin);
    const counsellorCookie = getCookies(counsellorLoginRes.headers);

    // Search for student "Vihaan"
    const searchAdmissionsRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/counsellor/admissions?search=Vihaan', method: 'GET',
      headers: { 'Cookie': counsellorCookie }
    });
    if (!searchAdmissionsRes.data.includes('Vihaan Sharma')) {
      throw new Error('Counsellor admissions search failed: Vihaan Sharma not found in search results!');
    }
    console.log('✅ Counsellor admissions name search works perfectly.');

    // 5. Verify Counsellor leads search
    console.log('\n🔑 Step 5: Counsellor searching leads page...');
    const searchCounsellorLeadsRes = await makeRequest({
      hostname: 'localhost', port: 3125, path: '/counsellor/leads?search=Vikram', method: 'GET',
      headers: { 'Cookie': counsellorCookie }
    });
    if (!searchCounsellorLeadsRes.data.includes('Vikram Malhotra')) {
      throw new Error('Counsellor leads search failed: Vikram Malhotra not found in search results!');
    }
    if (searchCounsellorLeadsRes.data.includes('Abhay Deol')) {
      throw new Error('Counsellor leads filtering failed: Abhay Deol should have been filtered out!');
    }
    console.log('✅ Counsellor leads name search works perfectly.');

    console.log('\n🎉 ALL MULTI-ROLE SEARCH INTEGRATION TESTS PASSED SUCCESSFULLY! 👑');

  } catch (error) {
    console.error('\n❌ SEARCH INTEGRATION TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('\n🛑 Shutting down test server...');
    serverProc.kill();
    console.log('👋 Cleaned up. Exiting.');
  }
}

run();
