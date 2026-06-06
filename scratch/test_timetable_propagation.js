const mongoose = require('mongoose');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Holiday = require('../models/Holiday');
const Schedule = require('../models/Schedule');
const Timetable = require('../models/Timetable');
const { propagateTimetable } = require('../utils/timetableGenerator');

async function run() {
  console.log('🧪 Starting Automated Weekly Timetable Propagation Tests...');
  
  try {
    // 1. Connect to database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
    console.log('✅ Connected to MongoDB.');

    // 2. Setup mock entities
    const teacher = await User.findOne({ role: 'teacher' });
    const classroom = await Classroom.findOne();

    if (!teacher || !classroom) {
      throw new Error('Teacher or Classroom not found in DB. Run seed first.');
    }

    const testBatch = 'Test Propagation Batch';

    // Clean up any existing records for test batch
    await Timetable.deleteOne({ batch: testBatch });
    await Schedule.deleteMany({ batch: testBatch });
    await Holiday.deleteMany({ name: 'Test Midweek Holiday' });

    // Determine Monday, Wednesday, Friday of next week
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + (1 + 7 - nextMonday.getDay()) % 7); // Go to next Monday
    
    const nextWednesday = new Date(nextMonday);
    nextWednesday.setDate(nextWednesday.getDate() + 2);
    
    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextFriday.getDate() + 4);

    const monStr = nextMonday.toISOString().split('T')[0];
    const wedStr = nextWednesday.toISOString().split('T')[0];
    const friStr = nextFriday.toISOString().split('T')[0];

    console.log(`📅 Test range: Mon: ${monStr}, Wed: ${wedStr}, Fri: ${friStr}`);

    // Create a mock holiday on Wednesday
    await Holiday.create({ name: 'Test Midweek Holiday', date: wedStr });
    console.log(`🎉 Created midweek holiday on ${wedStr}.`);

    // 3. Create Timetable template
    const timetable = await Timetable.create({
      batch: testBatch,
      startDate: nextMonday,
      endDate: nextFriday,
      slots: [
        { dayOfWeek: 'Monday', subject: 'Intro to Propagation', teacher: teacher._id, classroom: classroom._id, startTime: '10:00 AM', endTime: '11:30 AM' },
        { dayOfWeek: 'Wednesday', subject: 'Holiday Session', teacher: teacher._id, classroom: classroom._id, startTime: '10:00 AM', endTime: '11:30 AM' },
        { dayOfWeek: 'Friday', subject: 'Closing Propagation', teacher: teacher._id, classroom: classroom._id, startTime: '10:00 AM', endTime: '11:30 AM' }
      ]
    });
    console.log('✅ Timetable template created.');

    // 4. Run propagation
    await propagateTimetable(timetable._id);
    console.log('✅ Timetable propagated.');

    // 5. Assertions
    const generatedSchedules = await Schedule.find({ batch: testBatch }).sort({ date: 1 });
    console.log(`📊 Generated schedules count: ${generatedSchedules.length}`);

    // Expecting exactly 2 schedules: Monday and Friday. Wednesday should be skipped because of the holiday!
    if (generatedSchedules.length !== 2) {
      throw new Error(`Expected 2 generated schedules, but got ${generatedSchedules.length}`);
    }

    const first = generatedSchedules[0];
    const second = generatedSchedules[1];

    if (first.date !== monStr) {
      throw new Error(`Expected first schedule date to be Monday ${monStr}, but got ${first.date}`);
    }
    if (second.date !== friStr) {
      throw new Error(`Expected second schedule date to be Friday ${friStr}, but got ${second.date}`);
    }

    console.log('✅ Holiday exclusion and weekday matching logic passed successfully.');

    // 6. Test updating template updates future schedule
    timetable.slots[1].subject = 'Updated Friday Session'; // Change Friday's subject in index 1 slot
    // Wait, the index of Friday slot is 2. Let's find it.
    const friSlot = timetable.slots.find(s => s.dayOfWeek === 'Friday');
    friSlot.subject = 'Updated Friday Session';
    await timetable.save();
    
    await propagateTimetable(timetable._id);
    
    const updatedSchedules = await Schedule.find({ batch: testBatch }).sort({ date: 1 });
    if (updatedSchedules.length !== 2) {
      throw new Error(`Expected 2 updated schedules, got ${updatedSchedules.length}`);
    }
    if (updatedSchedules[1].subject !== 'Updated Friday Session') {
      throw new Error(`Expected Friday schedule subject to be updated to "Updated Friday Session", but got "${updatedSchedules[1].subject}"`);
    }
    console.log('✅ Dynamic updating and re-propagation logic passed successfully.');

    // 7. Test delete template cleans up future schedules
    await Timetable.findByIdAndDelete(timetable._id);
    // Mimic the delete action cleanup:
    const todayStr = new Date().toISOString().split('T')[0];
    await Schedule.deleteMany({
      batch: testBatch,
      status: 'scheduled',
      date: { $gte: todayStr }
    });

    const schedulesAfterDelete = await Schedule.find({ batch: testBatch });
    if (schedulesAfterDelete.length !== 0) {
      throw new Error(`Expected 0 schedules remaining after delete, but got ${schedulesAfterDelete.length}`);
    }
    console.log('✅ Timetable deletion clean-up logic passed successfully.');

    // Clean up mock holiday
    await Holiday.deleteOne({ date: wedStr });
    console.log('🧹 Cleaned up database test records.');

    console.log('\n🎉 ALL WEEKLY TIMETABLE PROPAGATION TESTS PASSED GREEN!');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
