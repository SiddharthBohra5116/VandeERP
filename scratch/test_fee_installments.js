const mongoose = require('mongoose');
const User = require('../models/User');
const Fee = require('../models/Fee');
const connectDB = require('../config/db');
const http = require('http');

async function testInstallmentsAndFines() {
  console.log('🧪 Starting Automated Fees Installments and Late Fines Tests...');
  await connectDB();

  // 1. Clear any prior test students
  const testEmail = 'installment.student@vandedigital.com';
  await User.deleteMany({ email: testEmail });
  
  const Course = require('../models/Course');
  const Batch = require('../models/Batch');
  const Student = require('../models/Student');

  let courseDoc = await Course.findOne({ name: 'Video Editing' });
  if (!courseDoc) {
    courseDoc = await Course.create({ name: 'Video Editing', code: 'VE', durationMonths: 3, fees: 25000 });
  }

  let batchDoc = await Batch.findOne({ name: 'VE-09AM-A1' });
  if (!batchDoc) {
    batchDoc = await Batch.create({ name: 'VE-09AM-A1', course: courseDoc._id, capacity: 20 });
  }

  // 2. Create Student with base tuition fees
  console.log('👣 [1/5] Creating test student with ₹40,000 total fees...');
  const user = await User.create({
    name: 'Installment Test Student',
    email: testEmail,
    password: 'password123',
    role: 'student',
    phone: '9876500001'
  });

  const student = await Student.create({
    userId: user._id,
    course: courseDoc._id,
    batch: batchDoc._id,
    fees_total: 40000,
    fees_paid: 0
  });

  // Explicitly instantiate Fee ledger (equivalent to admin/counsellor controllers)
  await Fee.create({
    student: student._id,
    course: courseDoc._id,
    batch: batchDoc._id,
    totalAmount: 40000,
  });

  // Fetch created Fee ledger
  let fee = await Fee.findOne({ student: student._id });
  if (!fee) {
    throw new Error('❌ Fee ledger not created for student.');
  }

  console.log('✅ Fee ledger created. Verifying 3-part installment split...');
  if (fee.installments.length !== 3) {
    throw new Error(`❌ Expected 3 installments, got ${fee.installments.length}`);
  }

  const [dp, inst1, inst2] = fee.installments;
  console.log(`   - ${dp.name}: ₹${dp.amount}`);
  console.log(`   - ${inst1.name}: ₹${inst1.amount}`);
  console.log(`   - ${inst2.name}: ₹${inst2.amount}`);

  if (dp.amount !== 20000 || inst1.amount !== 10000 || inst2.amount !== 10000) {
    throw new Error('❌ Installment amounts split is incorrect (should be 50% / 25% / 25%)');
  }
  console.log('✅ Split values are correct (₹20,000 / ₹10,000 / ₹10,000).');

  // 3. Register payment of ₹25,000
  console.log('\n👣 [2/5] Recording payment of ₹25,000 and verifying sequential allocation...');
  fee.payments.push({
    amount: 25000,
    method: 'UPI',
    transactionId: 'TXN12345',
    note: 'Initial payments log'
  });
  await fee.save();

  // Reload fee record
  fee = await Fee.findOne({ student: student._id });
  const [dpPaid, inst1Paid, inst2Paid] = fee.installments;

  console.log(`   - Down Payment Paid: ₹${dpPaid.paidAmount}/${dpPaid.amount}`);
  console.log(`   - Installment 1 Paid: ₹${inst1Paid.paidAmount}/${inst1Paid.amount}`);
  console.log(`   - Installment 2 Paid: ₹${inst2Paid.paidAmount}/${inst2Paid.amount}`);

  if (dpPaid.paidAmount !== 20000 || inst1Paid.paidAmount !== 5000 || inst2Paid.paidAmount !== 0) {
    throw new Error('❌ Payment allocation was not sequenced correctly.');
  }
  console.log('✅ Payments allocated sequentially.');

  // 4. Simulate Overdue Date and Fines
  console.log('\n👣 [3/5] Simulating overdue dates to trigger late fines...');
  
  // Make installment 1 (partially unpaid) overdue by 15 days
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  fee.installments[1].dueDate = fifteenDaysAgo;

  // Make installment 2 (fully unpaid) overdue by 40 days
  const fortyDaysAgo = new Date();
  fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
  fee.installments[2].dueDate = fortyDaysAgo;

  await fee.save();

  // Reload
  fee = await Fee.findOne({ student: student._id });
  
  console.log(`   - Installment 1 Due Date: ${fee.installments[1].dueDate.toLocaleDateString()}`);
  console.log(`   - Installment 2 Due Date: ${fee.installments[2].dueDate.toLocaleDateString()}`);
  console.log(`   - Total Late Fines Accrued: ₹${fee.totalFine}`);
  console.log(`   - Outstanding Due Balance: ₹${fee.dueAmount}`);

  // Expected Fines:
  // Installment 1 (15 days overdue): ₹250
  // Installment 2 (40 days overdue): ₹500
  // Total Fines: ₹750
  // Base Due: ₹15,000 (₹40,000 - ₹25,000)
  // Total Due: ₹15,750
  if (fee.totalFine !== 750) {
    throw new Error(`❌ Expected total fine of ₹750, got ₹${fee.totalFine}`);
  }
  if (fee.dueAmount !== 15750) {
    throw new Error(`❌ Expected due amount of ₹15,750, got ₹${fee.dueAmount}`);
  }
  console.log('✅ Late fee fines calculations are verified and correct!');

  // 5. Spin up server on port 3127 to check route responses
  console.log('\n👣 [4/5] Testing routing accessibility...');
  const { spawn } = require('child_process');
  const env = { ...process.env, PORT: '3127', NODE_ENV: 'development' };
  const serverProc = spawn('node', ['server.js'], { cwd: process.cwd(), env });

  // Wait for server spinup
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log('🚀 Server launched on port 3127');

  // Verify /auth/login page renders
  await new Promise((resolve, reject) => {
    http.get('http://localhost:3127/auth/login', (res) => {
      console.log(`   - /auth/login page response status: ${res.statusCode}`);
      if (res.statusCode !== 200) {
        reject(new Error(`/auth/login page returned status ${res.statusCode}`));
      } else {
        resolve();
      }
    });
  });
  console.log('✅ Routing verification passed.');

  // 6. Cleanup
  console.log('\n👣 [5/5] Cleaning up test records...');
  await User.deleteOne({ _id: user._id });
  await Student.deleteOne({ _id: student._id });
  await Fee.deleteOne({ student: student._id });
  serverProc.kill();
  
  console.log('\n🎉 ALL FEE INSTALLMENTS AND LATE FINES TESTS PASSED GREEN! 👑\n');
  process.exit(0);
}

testInstallmentsAndFines().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
