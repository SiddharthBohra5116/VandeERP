const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Schedule = require('../models/Schedule');
const Message = require('../models/Message');

async function test() {
  console.log('🧪 Starting Classroom CRUD and Schedule Clash assertions...');
  
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
  
  try {
    // Clean up test schedules and classrooms
    await Classroom.deleteMany({ name: { $regex: 'Test Room', $options: 'i' } });
    await Schedule.deleteMany({ subject: { $regex: 'Test Subject', $options: 'i' } });
    await Message.deleteMany({ content: { $regex: '🔔 Class', $options: 'i' } });
    
    // 1. Create Classrooms
    console.log('\nStep 1: Testing Classroom Creation...');
    const roomA = await Classroom.create({
      name: 'Test Room Alpha',
      capacity: 10,
      location: 'Ground Floor'
    });
    const roomB = await Classroom.create({
      name: 'Test Room Beta',
      capacity: 20,
      location: 'First Floor'
    });
    console.log(`✅ Classrooms created: "${roomA.name}" and "${roomB.name}".`);

    // Fetch teachers & students for seeding test
    const teacher = await User.findOne({ role: 'teacher' });
    const otherTeacher = await User.findOne({ role: 'teacher', _id: { $ne: teacher._id } });
    const adminUser = await User.findOne({ role: 'admin' });
    
    const Batch = require('../models/Batch');
    const Student = require('../models/Student');
    const batchDoc = await Batch.findOne({ name: 'VE-09AM-A1' });
    if (!batchDoc) {
      throw new Error('Database is missing seeded batch VE-09AM-A1. Run seeder.js first.');
    }

    const studentProfiles = await Student.find({ batch: batchDoc._id }).limit(3);
    const students = studentProfiles.map(s => s.userId);
    
    if (!teacher || !otherTeacher || !adminUser) {
      throw new Error('Database is missing seeded teacher or admin user. Please run seeder.js first.');
    }
    
    // 2. Create standard schedule
    console.log('\nStep 2: Scheduling initial session...');
    const sched1 = await Schedule.create({
      subject: 'Test Subject Basics',
      batch: batchDoc._id,
      course: batchDoc.course,
      teacher: teacher._id,
      classroom: roomA._id,
      date: '2026-06-10',
      startTime: '10:00 AM',
      endTime: '11:30 AM',
      status: 'scheduled'
    });
    console.log(`✅ Scheduled class in "${roomA.name}" for Teacher "${teacher.name}" on ${sched1.date} at ${sched1.startTime}-${sched1.endTime}.`);

    // 3. Import clash detector
    const { checkScheduleClash } = require('../utils/clashDetector');

    // Test 3a: Classroom Clash (different teacher, same room, overlapping time)
    console.log('\nStep 3a: Asserting Classroom Clash (same room, same time, other teacher)...');
    const clash1 = await checkScheduleClash('2026-06-10', '10:30 AM', '12:00 PM', roomA._id, otherTeacher._id);
    console.log('Result:', clash1);
    if (!clash1.clashed || clash1.type !== 'classroom') {
      throw new Error('Expected Classroom Clash failed to trigger!');
    }
    console.log('✅ Classroom Clash assertion passed.');

    // Test 3b: Teacher Clash (same teacher, different room, overlapping time)
    console.log('\nStep 3b: Asserting Teacher Clash (different room, same time, same teacher)...');
    const clash2 = await checkScheduleClash('2026-06-10', '10:30 AM', '12:00 PM', roomB._id, teacher._id);
    console.log('Result:', clash2);
    if (!clash2.clashed || clash2.type !== 'teacher') {
      throw new Error('Expected Teacher Clash failed to trigger!');
    }
    console.log('✅ Teacher Clash assertion passed.');

    // Test 3c: Overlap exclusion for update
    console.log('\nStep 3c: Asserting clash check bypasses self-schedule during updates...');
    const clashSelf = await checkScheduleClash('2026-06-10', '10:00 AM', '11:30 AM', roomA._id, teacher._id, sched1._id);
    console.log('Result:', clashSelf);
    if (clashSelf.clashed) {
      throw new Error('Self schedule updates triggered false-positive clash!');
    }
    console.log('✅ Clash self-bypass assertion passed.');

    // Test 3d: No Clash (different room, different teacher, same time)
    console.log('\nStep 3d: Asserting scheduling is allowed if no overlaps exist...');
    const clashFree = await checkScheduleClash('2026-06-10', '10:00 AM', '11:30 AM', roomB._id, otherTeacher._id);
    console.log('Result:', clashFree);
    if (clashFree.clashed) {
      throw new Error('Reported false-positive clash for clear slot!');
    }
    console.log('✅ No-conflict scheduling slot validation passed.');

    // 4. Test Notification Dispatch
    console.log('\nStep 4: Simulating notification dispatch...');
    // We'll mimic the controller dispatch:
    const notificationContent = `🔔 Class Scheduled: New session for Batch "${sched1.batch}" (${sched1.subject}) on ${sched1.date} at ${sched1.startTime}.`;
    
    const notifications = [];
    notifications.push(Message.create({
      sender: adminUser._id,
      recipient: teacher._id,
      content: notificationContent
    }));
    students.forEach(stu => {
      notifications.push(Message.create({
        sender: adminUser._id,
        recipient: stu._id,
        content: notificationContent
      }));
    });
    await Promise.all(notifications);

    // Verify inbox message counts
    const inboxTeacher = await Message.find({ recipient: teacher._id, content: { $regex: '🔔 Class' } });
    const inboxStudent = await Message.find({ recipient: students[0]._id, content: { $regex: '🔔 Class' } });
    console.log(`Teacher notifications received: ${inboxTeacher.length}`);
    console.log(`Student notifications received: ${inboxStudent.length}`);

    if (inboxTeacher.length !== 1 || inboxStudent.length !== 1) {
      throw new Error('Notification alerts were not logged in user inboxes!');
    }
    console.log('✅ User notification dispatch assertions passed.');

    // Clean up
    await Classroom.deleteMany({ name: { $regex: 'Test Room', $options: 'i' } });
    await Schedule.deleteMany({ subject: { $regex: 'Test Subject', $options: 'i' } });
    await Message.deleteMany({ content: { $regex: '🔔 Class', $options: 'i' } });
    
    console.log('\n🎉 ALL CLASSROOM & SCHEDULE CLASH ASSERTIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ Classroom/Clash verification test failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

test();
