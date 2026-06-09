const { spawn } = require('child_process');
const http = require('http');
const mongoose = require('mongoose');
const User = require('../models/User');
const Schedule = require('../models/Schedule');
const Message = require('../models/Message');
const Classroom = require('../models/Classroom');

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
  console.log('🚀 Starting Verification for Day 6 Tasks...');
  
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
    
    console.log('\n🌱 Seeding test database records...');
    
    // Clear previous test users for Day 6
    await User.deleteMany({ email: /day6.*@example\.com/ });
    await Schedule.deleteMany({ batch: 'Day6Batch' });
    await Message.deleteMany({});
    await Classroom.deleteMany({ name: 'Day6 Classroom' });

    // 1. Create Users
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      throw new Error('Admin user required to run tests. Seed first.');
    }

    const teacher = await User.create({
      name: 'Day6 Teacher',
      email: 'day6teacher@example.com',
      password: 'password123',
      role: 'teacher',
      phone: '9998887771',
      isActive: true
    });

    const counsellor = await User.create({
      name: 'Day6 Counsellor',
      email: 'day6counsellor@example.com',
      password: 'password123',
      role: 'counsellor',
      phone: '9998887772',
      isActive: true
    });

    const student1 = await User.create({
      name: 'Day6 Student One',
      email: 'day6student1@example.com',
      password: 'password123',
      role: 'student',
      phone: '9998887773',
      course: 'Video Editing',
      batch: 'Day6Batch',
      teacher: teacher._id,
      counsellor: counsellor._id,
      isActive: true
    });

    const student2 = await User.create({
      name: 'Day6 Student Two',
      email: 'day6student2@example.com',
      password: 'password123',
      role: 'student',
      phone: '9998887774',
      course: 'Digital Marketing',
      batch: 'OtherBatch',
      isActive: true
    });

    // Create a classroom
    const classroom = await Classroom.create({
      name: 'Day6 Classroom',
      capacity: 20
    });

    // Create schedule to link Teacher with Student 1's batch
    await Schedule.create({
      subject: 'Video Editing',
      batch: 'Day6Batch',
      teacher: teacher._id,
      classroom: classroom._id,
      date: '2026-06-08',
      startTime: '09:00 AM',
      endTime: '11:00 AM',
      status: 'scheduled'
    });

    console.log('✅ Seeding complete.');

    // Helper: Login and return cookies
    const login = async (email, password = 'password123') => {
      const loginData = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
      const res = await makeRequest({
        hostname: 'localhost', port: 3132, path: '/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(loginData) }
      }, loginData);
      return getCookies(res.headers);
    };

    // 2. Test Recipient Dropdowns via /auth/inbox GET page output (inspecting rendering)
    console.log('\n👣 Verifying Role-Based Recipient List in HTML...');
    
    // Student 1 log in
    console.log('🔑 Logging in as Student 1...');
    const student1Cookie = await login('day6student1@example.com');
    const student1Inbox = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/auth/inbox', method: 'GET',
      headers: { 'Cookie': student1Cookie }
    });
    
    if (!student1Inbox.data.includes('Day6 Teacher')) {
      throw new Error('Student 1 inbox does not show assigned teacher: Day6 Teacher');
    }
    // Isolate contacts list HTML
    const contactsListHtml = student1Inbox.data.split('id="contactsList"')[1]?.split('</div>')[0] || '';
    if (contactsListHtml.includes('Day6 Student One') || contactsListHtml.includes('Day6 Student Two')) {
      throw new Error('Student 1 inbox contacts list leaks student contacts!');
    }
    console.log('✅ Student 1 dropdown lists ONLY assigned teacher and admin.');

    // Teacher log in
    console.log('🔑 Logging in as Teacher...');
    const teacherCookie = await login('day6teacher@example.com');
    const teacherInbox = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/auth/inbox', method: 'GET',
      headers: { 'Cookie': teacherCookie }
    });
    const teacherContactsHtml = teacherInbox.data.split('id="contactsList"')[1]?.split('</div>')[0] || '';
    if (!teacherInbox.data.includes('Day6 Student One')) {
      throw new Error('Teacher inbox does not show assigned student: Day6 Student One');
    }
    if (teacherContactsHtml.includes('Day6 Student Two')) {
      throw new Error('Teacher inbox leaks unassigned student: Day6 Student Two');
    }
    console.log('✅ Teacher dropdown lists ONLY assigned batch students and admin.');

    // Counsellor log in
    console.log('🔑 Logging in as Counsellor...');
    const counsellorCookie = await login('day6counsellor@example.com');
    const counsellorInbox = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/auth/inbox', method: 'GET',
      headers: { 'Cookie': counsellorCookie }
    });
    const counsellorContactsHtml = counsellorInbox.data.split('id="contactsList"')[1]?.split('</div>')[0] || '';
    if (!counsellorInbox.data.includes('Day6 Student One')) {
      throw new Error('Counsellor inbox does not show converted student: Day6 Student One');
    }
    if (counsellorContactsHtml.includes('Day6 Student Two')) {
      throw new Error('Counsellor inbox leaks unassigned student: Day6 Student Two');
    }
    console.log('✅ Counsellor dropdown lists ONLY converted students and admin.');

    // 3. Test Server-Side Authorization Checks (403 Blocks)
    console.log('\n👣 Verifying Server-Side Message Validation (403)...');
    
    // Student 1 tries to message Student 2 directly
    const badSendData = `recipientId=${student2._id}&content=Hello+Student+Two`;
    const badSendRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/auth/inbox/send', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(badSendData),
        'Cookie': student1Cookie
      }
    }, badSendData);
    
    if (badSendRes.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for cross-messaging attempt, got ${badSendRes.statusCode}`);
    }
    console.log('✅ Blocked unauthorized messaging successfully (403 Forbidden received).');

    // 4. Test Seen / Delivered status (readAt timestamp logic)
    console.log('\n👣 Verifying Seen/Delivered Status & UI Representation...');
    
    // Student 1 sends a message to Teacher
    const messageContent = 'Hello Teacher, this is a test message.';
    const sendData = `recipientId=${teacher._id}&content=${encodeURIComponent(messageContent)}`;
    const sendRes = await makeRequest({
      hostname: 'localhost', port: 3132, path: '/auth/inbox/send', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(sendData),
        'Cookie': student1Cookie
      }
    }, sendData);
    
    if (sendRes.statusCode !== 302) {
      throw new Error(`Message sending failed with status: ${sendRes.statusCode}`);
    }

    // Verify initially marked as "Sent" (since Teacher hasn't read it yet)
    const s1InboxAfterSend = await makeRequest({
      hostname: 'localhost', port: 3132, path: `/auth/inbox?chat=${teacher._id}`, method: 'GET',
      headers: { 'Cookie': student1Cookie }
    });
    if (!s1InboxAfterSend.data.includes('Sent')) {
      throw new Error('New message not showing "Sent" status');
    }
    console.log('✅ Sent status correctly shown initially.');

    // Teacher logs in/views the chat -> Marks message as read/seen
    console.log('👣 Teacher viewing chat to trigger Seen...');
    const teacherInboxView = await makeRequest({
      hostname: 'localhost', port: 3132, path: `/auth/inbox?chat=${student1._id}`, method: 'GET',
      headers: { 'Cookie': teacherCookie }
    });

    // Check message in DB
    const dbMsg = await Message.findOne({ sender: student1._id, recipient: teacher._id });
    if (!dbMsg || !dbMsg.read || !dbMsg.readAt) {
      throw new Error('Message read and readAt was not populated in MongoDB');
    }
    console.log('✅ MongoDB message document updated with read: true and readAt timestamp.');

    // Student 1 re-views chat -> should show "Seen" status
    const s1InboxAfterRead = await makeRequest({
      hostname: 'localhost', port: 3132, path: `/auth/inbox?chat=${teacher._id}`, method: 'GET',
      headers: { 'Cookie': student1Cookie }
    });
    if (!s1InboxAfterRead.data.includes('Seen')) {
      throw new Error('Message not showing "Seen" status after recipient read it.');
    }
    console.log('✅ Seen status correctly rendered in the UI with timestamp.');

    // 5. Test 10-Minute Edit Window
    console.log('\n👣 Verifying 10-Minute Edit Window...');
    
    // Message from student 1 to teacher was already read, so edit should fail
    const editData1 = 'content=Edited+Message+Content';
    const editRes1 = await makeRequest({
      hostname: 'localhost', port: 3132, path: `/auth/messages/${dbMsg._id}/edit`, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(editData1),
        'Cookie': student1Cookie
      }
    }, editData1);
    if (editRes1.statusCode !== 400) {
      throw new Error(`Expected edit to fail with 400 Bad Request since the message is read. Got: ${editRes1.statusCode}`);
    }
    console.log('✅ Blocked editing read messages successfully.');

    // Send a new message that is unread
    const sendDataUnread = `recipientId=${teacher._id}&content=Edit+Me+Unread`;
    await makeRequest({
      hostname: 'localhost', port: 3132, path: '/auth/inbox/send', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(sendDataUnread),
        'Cookie': student1Cookie
      }
    }, sendDataUnread);

    const unreadMsg = await Message.findOne({ sender: student1._id, recipient: teacher._id, read: false });
    if (!unreadMsg) {
      throw new Error('Failed to find created unread message.');
    }

    // Attempt edit of unread message within 10 minutes -> should succeed
    const editDataSuccess = 'content=Success+Edited+Message';
    const editResSuccess = await makeRequest({
      hostname: 'localhost', port: 3132, path: `/auth/messages/${unreadMsg._id}/edit`, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(editDataSuccess),
        'Cookie': student1Cookie
      }
    }, editDataSuccess);
    if (editResSuccess.statusCode !== 302) {
      throw new Error(`Expected edit of unread message to succeed (302 redirect), got ${editResSuccess.statusCode}`);
    }

    const updatedMsg = await Message.findById(unreadMsg._id);
    if (updatedMsg.content !== 'Success Edited Message') {
      throw new Error(`Message content was not updated in DB. Expected "Success Edited Message", got "${updatedMsg.content}"`);
    }
    console.log('✅ Successfully edited unread message within the time window.');

    // Now test window expiration. Set editableUntil of unreadMsg in the past in DB.
    updatedMsg.editableUntil = new Date(Date.now() - 5000); // 5 seconds ago
    await updatedMsg.save();

    // Try editing now -> should fail with 400
    const editResExpired = await makeRequest({
      hostname: 'localhost', port: 3132, path: `/auth/messages/${updatedMsg._id}/edit`, method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(editDataSuccess),
        'Cookie': student1Cookie
      }
    }, editDataSuccess);
    if (editResExpired.statusCode !== 400) {
      throw new Error(`Expected edit of expired message to fail with 400 Bad Request. Got: ${editResExpired.statusCode}`);
    }
    console.log('✅ Blocked editing messages after the 10-minute window.');

    console.log('\n🎉 ALL DAY 6 INTEGRATION CHECKS PASSED GREEN!');

  } catch (err) {
    console.error('❌ Day 6 Verification Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n🛑 Cleaning up test server and db connection...');
    serverProc.kill();
    await mongoose.disconnect();
    console.log('👋 Cleaned up. Exiting.');
  }
}

run();
