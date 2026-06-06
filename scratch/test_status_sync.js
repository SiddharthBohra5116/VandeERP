const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function test() {
  console.log('🧪 Starting status and isActive synchronization checks...');
  
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
  
  try {
    // Clear any existing test user if present
    await User.deleteMany({ email: 'test.status@gmail.com' });
    
    // Test 1: Create new user with default status ('active')
    console.log('\nTest 1: Creating user with default status...');
    let u = await User.create({
      name: 'Test Status User',
      email: 'test.status@gmail.com',
      password: 'password123',
      role: 'student',
      course: 'Video Editing',
      batch: 'Batch Video Editing Morning'
    });
    
    console.log(`Status: ${u.status}, isActive: ${u.isActive}`);
    if (u.status !== 'active' || u.isActive !== true) {
      throw new Error('Default status/isActive failed to set correctly!');
    }
    console.log('✅ Default active status checks out.');
    
    // Test 2: Modify status to 'drop'
    console.log('\nTest 2: Modifying status to "drop"...');
    u.status = 'drop';
    await u.save();
    console.log(`Status: ${u.status}, isActive: ${u.isActive}`);
    if (u.status !== 'drop' || u.isActive !== false) {
      throw new Error('Sync from status -> isActive failed for "drop"!');
    }
    console.log('✅ Sync for "drop" works.');

    // Test 3: Modify status to 'complete'
    console.log('\nTest 3: Modifying status to "complete"...');
    u.status = 'complete';
    await u.save();
    console.log(`Status: ${u.status}, isActive: ${u.isActive}`);
    if (u.status !== 'complete' || u.isActive !== false) {
      throw new Error('Sync from status -> isActive failed for "complete"!');
    }
    console.log('✅ Sync for "complete" works.');

    // Test 4: Modify status to 'inactive'
    console.log('\nTest 4: Modifying status to "inactive"...');
    u.status = 'inactive';
    await u.save();
    console.log(`Status: ${u.status}, isActive: ${u.isActive}`);
    if (u.status !== 'inactive' || u.isActive !== false) {
      throw new Error('Sync from status -> isActive failed for "inactive"!');
    }
    console.log('✅ Sync for "inactive" works.');

    // Test 5: Modify isActive to true
    console.log('\nTest 5: Modifying isActive to true...');
    u.isActive = true;
    await u.save();
    console.log(`Status: ${u.status}, isActive: ${u.isActive}`);
    if (u.status !== 'active' || u.isActive !== true) {
      throw new Error('Sync from isActive -> status failed when setting true!');
    }
    console.log('✅ Sync from isActive=true -> status=active works.');

    // Test 6: Modify isActive to false
    console.log('\nTest 6: Modifying isActive to false...');
    u.isActive = false;
    await u.save();
    console.log(`Status: ${u.status}, isActive: ${u.isActive}`);
    if (u.status !== 'inactive' || u.isActive !== false) {
      throw new Error('Sync from isActive -> status failed when setting false!');
    }
    console.log('✅ Sync from isActive=false -> status=inactive works.');

    // Clean up
    await User.deleteOne({ _id: u._id });
    console.log('\n🎉 ALL STATUS SYNC ASSERTIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ Status verification test failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

test();
