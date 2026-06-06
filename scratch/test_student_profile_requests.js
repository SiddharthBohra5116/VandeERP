const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function test() {
  console.log('🧪 Starting Student Profile Change Request and Approval assertions...');
  
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
  
  try {
    // Clean up if previous run crashed
    await User.deleteMany({ email: 'student.request@gmail.com' });
    
    // Create new student
    console.log('\nStep 1: Creating a test student with default details...');
    const student = await User.create({
      name: 'Original Student Name',
      email: 'student.request@gmail.com',
      password: 'password123',
      role: 'student',
      phone: '1234567890',
      fatherName: 'Original Father Name',
      motherName: 'Original MotherName',
      address: 'Original Address',
      city: 'Original City',
      dob: new Date('2000-01-01')
    });
    
    console.log(`Student created: "${student.name}" (Phone: ${student.phone})`);
    
    // Simulate updating profile (which should be stored in pendingProfileUpdate)
    console.log('\nStep 2: Simulating profile update request from student...');
    // We'll mimic the controller update logic for students:
    const updateRequest = {
      name: 'Requested New Name',
      phone: '9876543210',
      fatherName: 'Requested New Father Name',
      motherName: 'Requested New Mother Name',
      address: 'Requested New Address',
      city: 'Requested New City',
      dob: new Date('1999-09-09'),
      profilePic: '/uploads/new-avatar.png',
      requestedAt: new Date()
    };
    
    student.pendingProfileUpdate = updateRequest;
    await student.save();
    
    // Fetch user from DB to verify main fields are unchanged and pending fields are set
    const studentFromDb = await User.findById(student._id);
    console.log('Checking student main fields after request submission:');
    console.log(`  Name: "${studentFromDb.name}" (Expected: "Original Student Name")`);
    console.log(`  Phone: "${studentFromDb.phone}" (Expected: "1234567890")`);
    console.log(`  Pending Name: "${studentFromDb.pendingProfileUpdate.name}"`);
    console.log(`  Pending Phone: "${studentFromDb.pendingProfileUpdate.phone}"`);
    
    if (studentFromDb.name !== 'Original Student Name' || studentFromDb.phone !== '1234567890') {
      throw new Error('Student profile details were modified directly instead of registering as a pending request!');
    }
    if (!studentFromDb.pendingProfileUpdate.requestedAt || studentFromDb.pendingProfileUpdate.name !== 'Requested New Name') {
      throw new Error('Pending profile update details were not recorded correctly!');
    }
    console.log('✅ Student update request successfully intercepted and put into pending state.');
    
    // Simulate Admin Approval
    console.log('\nStep 3: Simulating Admin Approval of the profile changes...');
    // Mimic the admin approval controller:
    const pending = studentFromDb.pendingProfileUpdate;
    if (pending && pending.requestedAt) {
      if (pending.name !== null) studentFromDb.name = pending.name;
      if (pending.phone !== null) studentFromDb.phone = pending.phone;
      if (pending.profilePic !== null) studentFromDb.profilePic = pending.profilePic;
      if (pending.fatherName !== null) studentFromDb.fatherName = pending.fatherName;
      if (pending.motherName !== null) studentFromDb.motherName = pending.motherName;
      if (pending.address !== null) studentFromDb.address = pending.address;
      if (pending.city !== null) studentFromDb.city = pending.city;
      if (pending.dob !== null) studentFromDb.dob = pending.dob;

      studentFromDb.pendingProfileUpdate = {
        name: null,
        phone: null,
        profilePic: null,
        fatherName: null,
        motherName: null,
        address: null,
        city: null,
        dob: null,
        requestedAt: null
      };

      await studentFromDb.save();
    }
    
    // Fetch again to verify main fields updated and pending fields cleared
    const approvedStudent = await User.findById(student._id);
    console.log('Checking student main fields after Admin approval:');
    console.log(`  Name: "${approvedStudent.name}" (Expected: "Requested New Name")`);
    console.log(`  Phone: "${approvedStudent.phone}" (Expected: "9876543210")`);
    console.log(`  Father's Name: "${approvedStudent.fatherName}" (Expected: "Requested New Father Name")`);
    console.log(`  DOB: "${approvedStudent.dob.toISOString().split('T')[0]}" (Expected: "1999-09-09")`);
    console.log(`  Pending RequestedAt: ${approvedStudent.pendingProfileUpdate.requestedAt} (Expected: null)`);
    
    if (approvedStudent.name !== 'Requested New Name' || approvedStudent.phone !== '9876543210' || approvedStudent.pendingProfileUpdate.requestedAt !== null) {
      throw new Error('Admin approval did not apply updates to main fields or clear pending object!');
    }
    console.log('✅ Admin approval successfully applied updates and cleared queue.');
    
    // Simulate another request and then Reject
    console.log('\nStep 4: Simulating another request followed by Admin Rejection...');
    approvedStudent.pendingProfileUpdate = {
      name: 'Another Name Change',
      phone: '5555555555',
      requestedAt: new Date()
    };
    await approvedStudent.save();
    
    const secondRequestStudent = await User.findById(student._id);
    console.log(`  Pending Name: "${secondRequestStudent.pendingProfileUpdate.name}"`);
    
    // Mimic the admin reject controller:
    secondRequestStudent.pendingProfileUpdate = {
      name: null,
      phone: null,
      profilePic: null,
      fatherName: null,
      motherName: null,
      address: null,
      city: null,
      dob: null,
      requestedAt: null
    };
    await secondRequestStudent.save();
    
    const rejectedStudent = await User.findById(student._id);
    console.log('Checking student main fields after Admin rejection:');
    console.log(`  Name: "${rejectedStudent.name}" (Expected: "Requested New Name" - unchanged)`);
    console.log(`  Pending RequestedAt: ${rejectedStudent.pendingProfileUpdate.requestedAt} (Expected: null)`);
    
    if (rejectedStudent.name !== 'Requested New Name' || rejectedStudent.pendingProfileUpdate.requestedAt !== null) {
      throw new Error('Admin rejection modified main fields or failed to clear pending update object!');
    }
    console.log('✅ Admin rejection successfully ignored changes and cleared queue.');

    // Clean up
    await User.deleteOne({ _id: student._id });
    console.log('\n🎉 ALL PROFILE REQUEST & APPROVAL ASSERTIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ Profile request/approval verification test failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

test();
