const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

const Lead = require('../models/Lead');
const User = require('../models/User');
const Fee = require('../models/Fee');

// Helper to make HTTP requests
function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3126,
      path: path,
      method: method,
      headers: {
        ...headers
      }
    };
    if (body) {
      if (typeof body === 'object') {
        body = new URLSearchParams(body).toString();
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log('🧪 Starting Counsellor CRM Depth E2E Verification Tests...\n');
  
  // 1. Connect to Mongo
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/basic_erp';
  await mongoose.connect(mongoUri);
  console.log('🔌 Connected to Database');

  // 2. Fetch or Create Users
  let counsellor = await User.findOne({ role: 'counsellor' });
  if (!counsellor) {
    counsellor = await User.create({
      name: 'Test Counsellor',
      email: 'testcounsellor@gmail.com',
      password: 'password123',
      role: 'counsellor',
      phone: '9876543210',
      isActive: true
    });
    console.log('➕ Created Temp Counsellor');
  }

  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({
      name: 'Test Admin',
      email: 'testadmin@gmail.com',
      password: 'password123',
      role: 'admin',
      phone: '9876543211',
      isActive: true
    });
    console.log('➕ Created Temp Admin');
  }

  // 3. Generate JWT Token for authentication
  const token = jwt.sign({ id: counsellor._id }, process.env.JWT_SECRET || 'vande_secret_key');
  const cookieHeader = `token=${token}`;

  // 4. Start Express Server
  const app = require('../server');
  // Express app listens automatically inside server.js on process.env.PORT || 3000.
  // Wait, let's override process.env.PORT before requiring if possible, but server.js is already required or started.
  // Let's check: in server.js, did it call app.listen(PORT)?
  // Yes, lines 154-156:
  // const PORT = process.env.PORT || 3000;
  // app.listen(PORT, ...);
  // Oh, wait! If we require('../server') directly, it will start on the default port (3000 or whatever is in .env).
  // But wait, the server in server.js might fail to start if port 3000 is already in use by the active dev server on 3125.
  // Let's check what port is configured. Let's see if we can check if the server is running on 3125.
  // In the active context: "External dev server instances run on port 3125".
  // So PORT=3126 is safe to run! Let's temporarily run the script by passing PORT=3126 environment variable to the command.
  // Let's verify how we can do this. We can just set process.env.PORT = 3126 before requiring '../server'!
  // Let's check: inside server.js, the require('./config/db') and other things will be executed.
  // Wait! In server.js, process.env.PORT is read when server.js is run. So setting process.env.PORT = 3126 before requiring it is perfect!
  // Let's add that to our script.

  // 5. Clean up old test data if any
  await Lead.deleteMany({ name: 'CRM Test Prospect' });

  // 6. Test Step 1: Create a Lead
  console.log('👣 [1/5] Creating a new lead...');
  const createRes = await request('POST', '/counsellor/leads/create', { Cookie: cookieHeader }, {
    name: 'CRM Test Prospect',
    phone: '9999888877',
    email: 'crmprospect@gmail.com',
    course: 'Video Editing',
    source: 'Website',
    notes: 'Looking for video editing courses.',
    followUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 2 days in future
  });

  if (createRes.statusCode !== 302) {
    throw new Error(`Failed to create lead, got status code ${createRes.statusCode}`);
  }
  console.log('✅ Lead created successfully');

  // Fetch the created lead from DB
  const lead = await Lead.findOne({ name: 'CRM Test Prospect' });
  if (!lead) {
    throw new Error('Created lead not found in database');
  }

  // 7. Test Step 2: Log Call 1 (busy)
  console.log('👣 [2/5] Logging Call 1 (Outcome: busy)...');
  const call1Res = await request('POST', `/counsellor/leads/${lead._id}/followup`, { Cookie: cookieHeader }, {
    status: 'contacted',
    channel: 'Call',
    callOutcome: 'busy',
    callDuration: '0s',
    note: 'Attempt 1 - Line busy.',
    followUpDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  if (call1Res.statusCode !== 302) {
    throw new Error(`Failed to log Call 1, status: ${call1Res.statusCode}`);
  }

  // Fetch detail page and check Call Dot color (should be red for busy)
  const detail1Res = await request('GET', `/counsellor/leads/${lead._id}`, { Cookie: cookieHeader });
  // Verify Call Attempt Dots in HTML
  if (!detail1Res.body.includes('background:var(--red)')) {
    throw new Error('Verification Failed: Call 1 status dot is NOT red for busy outcome.');
  }
  console.log('✅ Verified Call 1 dot is red (busy)');

  // 8. Test Step 3: Log Call 2 (answered)
  console.log('👣 [3/5] Logging Call 2 (Outcome: answered)...');
  const call2Res = await request('POST', `/counsellor/leads/${lead._id}/followup`, { Cookie: cookieHeader }, {
    status: 'interested',
    channel: 'Call',
    callOutcome: 'answered',
    callDuration: '1m 15s',
    note: 'Attempt 2 - Prospect answered, scheduled callback.',
    followUpDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Overdue for task queue test!
  });

  if (call2Res.statusCode !== 302) {
    throw new Error(`Failed to log Call 2, status: ${call2Res.statusCode}`);
  }

  // Fetch detail page and check Call Dots (Call 1: red, Call 2: green)
  const detail2Res = await request('GET', `/counsellor/leads/${lead._id}`, { Cookie: cookieHeader });
  if (!detail2Res.body.includes('background:var(--red)')) {
    throw new Error('Verification Failed: Call 1 dot is missing red.');
  }
  if (!detail2Res.body.includes('background:var(--green)')) {
    throw new Error('Verification Failed: Call 2 status dot is NOT green for answered outcome.');
  }
  console.log('✅ Verified Call 2 dot is green (answered)');

  // 9. Test Step 4: Verify Touchpoint Timeline Gap display
  console.log('👣 [4/5] Verifying Touchpoint Timeline gap display...');
  if (!detail2Res.body.includes('Touchpoint Timeline')) {
    throw new Error('Verification Failed: Touchpoint Timeline card is missing from page.');
  }
  if (!detail2Res.body.includes('gap')) {
    throw new Error('Verification Failed: Gap durations are missing from timeline.');
  }
  console.log('✅ Verified Touchpoint Timeline gap displays correctly');

  // 10. Test Step 5: Verify Today\'s Task Queue and CRM Source Analytics
  console.log('👣 [5/5] Verifying Dashboard Task Queue & Lead Source Analytics...');
  const dashboardRes = await request('GET', '/counsellor/dashboard', { Cookie: cookieHeader });
  
  if (!dashboardRes.body.includes("Today's Task Queue")) {
    throw new Error('Verification Failed: Today\'s Task Queue panel is missing from dashboard.');
  }
  if (!dashboardRes.body.includes(lead.name)) {
    throw new Error('Verification Failed: Overdue lead is missing from task queue.');
  }
  if (!dashboardRes.body.includes('CRM Analytics: Lead Source Performance')) {
    throw new Error('Verification Failed: CRM Analytics table is missing from dashboard.');
  }
  console.log('✅ Verified Today\'s Task Queue & Lead Source Performance Analytics');

  // Clean up database
  await Lead.deleteMany({ name: 'CRM Test Prospect' });
  console.log('🧹 Cleaned up database test records');

  console.log('\n🎉 ALL E2E CRM DEPTH INTEGRATION TESTS PASSED GREEN!');
  process.exit(0);
}

// Override PORT to avoid conflict
process.env.PORT = 3126;
run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
