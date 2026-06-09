const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');

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
  console.log('🚀 Starting Integration Tests for Admin-Counsellor Comments Pipeline...');

  // Start the server in a separate process on port 3123
  const env = { ...process.env, PORT: '3123', NODE_ENV: 'development' };
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

  let counsellorCookie = '';
  let adminCookie = '';
  let leadId = '';

  try {
    // 1. Log in as Counsellor
    console.log('\n🔑 Step 1: Logging in as Counsellor Anjali Verma...');
    const counsellorLoginData = 'email=counsellor%40gmail.com&password=password123';
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 3123,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(counsellorLoginData)
      }
    }, counsellorLoginData);

    if (loginRes.statusCode !== 302) {
      throw new Error(`Counsellor Login failed: status code ${loginRes.statusCode}`);
    }
    counsellorCookie = getCookies(loginRes.headers);
    console.log('✅ Counsellor logged in successfully. Cookie obtained.');

    // Connect to DB directly to fetch our target lead ID for Vikram Malhotra
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
    const lead = await Lead.findOne({ name: 'Vikram Malhotra' });
    if (!lead) {
      throw new Error('Vikram Malhotra lead not found in database. Seed the database first.');
    }
    leadId = lead._id.toString();
    console.log(`📌 Found target Lead: Vikram Malhotra (ID: ${leadId})`);

    // 2. Fetch Lead Details as Counsellor (Ensure access)
    console.log('\n📞 Step 2: Fetching Lead Detail page as Counsellor...');
    const detailRes = await makeRequest({
      hostname: 'localhost',
      port: 3123,
      path: `/counsellor/leads/${leadId}`,
      method: 'GET',
      headers: {
        'Cookie': counsellorCookie
      }
    });

    if (detailRes.statusCode !== 200) {
      throw new Error(`Failed to fetch lead details as counsellor: ${detailRes.statusCode}`);
    }
    console.log('✅ Lead detail page loaded successfully as Counsellor.');

    // 3. Log a Follow-up as Counsellor
    console.log('\n📞 Step 3: Counsellor logs a follow-up...');
    const followUpPostData = 'status=interested&followUpDate=2026-06-10&note=Counsellor+Anjali+spoke+to+Vikram.+He+wants+to+join+Digital+Marketing+starting+Monday.';
    const followUpRes = await makeRequest({
      hostname: 'localhost',
      port: 3123,
      path: `/counsellor/leads/${leadId}/followup`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(followUpPostData),
        'Cookie': counsellorCookie
      }
    }, followUpPostData);

    if (followUpRes.statusCode !== 302) {
      throw new Error(`Counsellor follow-up request failed: ${followUpRes.statusCode}`);
    }
    console.log('✅ Follow-up logged by Counsellor. Redirected.');

    // 4. Log in as Admin
    console.log('\n🔑 Step 4: Logging in as Admin...');
    const adminLoginData = 'email=admin%40vandedigital.com&password=password123';
    const adminLoginRes = await makeRequest({
      hostname: 'localhost',
      port: 3123,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(adminLoginData)
      }
    }, adminLoginData);

    if (adminLoginRes.statusCode !== 302) {
      throw new Error(`Admin Login failed: status code ${adminLoginRes.statusCode}`);
    }
    adminCookie = getCookies(adminLoginRes.headers);
    console.log('✅ Admin logged in successfully. Cookie obtained.');

    // 5. Fetch Lead Details as Admin
    console.log('\n👑 Step 5: Fetching Lead Detail page as Admin...');
    const adminDetailRes = await makeRequest({
      hostname: 'localhost',
      port: 3123,
      path: `/admin/leads/${leadId}`,
      method: 'GET',
      headers: {
        'Cookie': adminCookie
      }
    });

    if (adminDetailRes.statusCode !== 200) {
      throw new Error(`Failed to fetch lead details as admin: ${adminDetailRes.statusCode}`);
    }
    console.log('✅ Lead detail page loaded successfully as Admin.');

    // 6. Post an Admin Comment (Instruction for Counsellor)
    console.log('\n👑 Step 6: Admin posts comment/instruction...');
    const adminCommentData = 'note=Please+offer+him+a+10%25+spot+discount+if+he+registers+by+this+Friday.+Assign+him+to+Morning+Batch.';
    const adminCommentRes = await makeRequest({
      hostname: 'localhost',
      port: 3123,
      path: `/admin/leads/${leadId}/comment`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(adminCommentData),
        'Cookie': adminCookie
      }
    }, adminCommentData);

    if (adminCommentRes.statusCode !== 302) {
      throw new Error(`Admin comment submission failed: status ${adminCommentRes.statusCode}`);
    }
    console.log('✅ Admin instruction comment posted successfully.');

    // 7. Verify Timeline rendering for Admin in Admin Lead Details
    console.log('\n👑 Step 7: Verifying timeline display on Admin Lead Details page...');
    const adminDetailVerify = await makeRequest({
      hostname: 'localhost',
      port: 3123,
      path: `/admin/leads/${leadId}`,
      method: 'GET',
      headers: {
        'Cookie': adminCookie
      }
    });

    if (!adminDetailVerify.data.includes('👑 Admin Instruction')) {
      throw new Error('Verification failed: "👑 Admin Instruction" badge not found on Admin Lead Details page.');
    }
    if (!adminDetailVerify.data.includes('Please offer him a 10% spot discount if he registers by this Friday.')) {
      throw new Error('Verification failed: Admin instruction text not found on Admin Lead Details page.');
    }
    console.log('✅ Admin Lead Details page displays Admin instruction correctly.');

    // 8. Verify Timeline rendering for Counsellor (Gold highlighting & Crown)
    console.log('\n📞 Step 8: Verifying timeline display on Counsellor Lead Details page...');
    const counsellorDetailVerify = await makeRequest({
      hostname: 'localhost',
      port: 3123,
      path: `/counsellor/leads/${leadId}`,
      method: 'GET',
      headers: {
        'Cookie': counsellorCookie
      }
    });

    if (!counsellorDetailVerify.data.includes('👑 Admin Instruction')) {
      throw new Error('Verification failed: "👑 Admin Instruction" badge not found on Counsellor Lead Details page.');
    }
    if (!counsellorDetailVerify.data.includes('Please offer him a 10% spot discount if he registers by this Friday.')) {
      throw new Error('Verification failed: Admin instruction text not found on Counsellor Lead Details page.');
    }
    if (!counsellorDetailVerify.data.includes('border-left: 2px solid var(--gold-border); padding-left: 10px;')) {
      throw new Error('Verification failed: Gold styling border-left style missing for admin instructions.');
    }
    console.log('✅ Counsellor Lead Details page displays Admin instruction with Gold highlight and Crown badge successfully!');

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 👑');

  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    // Shutdown server
    console.log('\n🛑 Shutting down test server...');
    serverProc.kill();
    await mongoose.disconnect();
    console.log('👋 Cleaned up. Exiting.');
  }
}

run();
