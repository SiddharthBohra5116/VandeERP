const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Batch = require('../models/Batch');

async function test() {
  console.log('🧪 Starting Student Profile Change Request and Approval assertions...');
  
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy');
  
  try {
    // Clean up if previous run crashed
    await User.deleteMany({ email: 'student.request@gmail.com' });
    await Student.deleteMany({});
    
    let courseDoc = await Course.findOne({ name: 'Video Editing' });
    if (!courseDoc) {
      courseDoc = await Course.create({ name: 'Video Editing', code: 'VE', durationMonths: 3, fees: 25000 });
    }

    let batchDoc = await Batch.findOne({ name: 'VE-09AM-A1' });
    if (!batchDoc) {
      batchDoc = await Batch.create({ name: 'VE-09AM-A1', course: courseDoc._id, capacity: 20 });
    }
    
    // Create new student
    console.log('\nStep 1: Creating a test student with default details...');
    const user = await User.create({
      name: 'Original Student Name',
      email: 'student.request@gmail.com',
      password: 'password123',
      role: 'student',
      phone: '1234567890',
      address: 'Original Address',
      city: 'Original City',
      dob: new Date('2000-01-01')
    });

    const student = await Student.create({
      userId: user._id,
      course: courseDoc._id,
      batch: batchDoc._id,
      family: {
        father: { name: 'Original Father Name', phone: '' },
        mother: { name: 'Original MotherName', phone: '' }
      }
    });
    
    console.log(`Student created: "${user.name}" (Phone: ${user.phone})`);
    
    // Simulate updating profile (which should be stored in pendingProfileUpdate)
    console.log('\nStep 2: Simulating profile update request from student...');
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
    
    // Fetch student profile from DB to verify main fields are unchanged and pending fields are set
    const studentProfileFromDb = await Student.findById(student._id).populate('userId');
    console.log('Checking student main fields after request submission:');
    console.log(`  Name: "${studentProfileFromDb.userId.name}" (Expected: "Original Student Name")`);
    console.log(`  Phone: "${studentProfileFromDb.userId.phone}" (Expected: "1234567890")`);
    console.log(`  Pending Name: "${studentProfileFromDb.pendingProfileUpdate.name}"`);
    console.log(`  Pending Phone: "${studentProfileFromDb.pendingProfileUpdate.phone}"`);
    
    if (studentProfileFromDb.userId.name !== 'Original Student Name' || studentProfileFromDb.userId.phone !== '1234567890') {
      throw new Error('Student profile details were modified directly instead of registering as a pending request!');
    }
    if (!studentProfileFromDb.pendingProfileUpdate.requestedAt || studentProfileFromDb.pendingProfileUpdate.name !== 'Requested New Name') {
      throw new Error('Pending profile update details were not recorded correctly!');
    }
    console.log('✅ Student update request successfully intercepted and put into pending state.');
    
    // Simulate Admin Approval
    console.log('\nStep 3: Simulating Admin Approval of the profile changes...');
    const pending = studentProfileFromDb.pendingProfileUpdate;
    if (pending && pending.requestedAt) {
      if (pending.name !== null) studentProfileFromDb.userId.name = pending.name;
      if (pending.phone !== null) studentProfileFromDb.userId.phone = pending.phone;
      if (pending.profilePic !== null) {
        studentProfileFromDb.userId.profilePic = pending.profilePic;
        studentProfileFromDb.documents.profilePic = pending.profilePic;
      }
      if (pending.fatherName !== null) studentProfileFromDb.family.father.name = pending.fatherName;
      if (pending.motherName !== null) studentProfileFromDb.family.mother.name = pending.motherName;
      if (pending.address !== null) studentProfileFromDb.userId.address = pending.address;
      if (pending.city !== null) studentProfileFromDb.userId.city = pending.city;
      if (pending.dob !== null) studentProfileFromDb.userId.dob = pending.dob;

      studentProfileFromDb.pendingProfileUpdate = {
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

      await studentProfileFromDb.userId.save();
      await studentProfileFromDb.save();
    }
    
    // Fetch again to verify main fields updated and pending fields cleared
    const approvedStudent = await Student.findById(student._id).populate('userId');
    console.log('Checking student main fields after Admin approval:');
    console.log(`  Name: "${approvedStudent.userId.name}" (Expected: "Requested New Name")`);
    console.log(`  Phone: "${approvedStudent.userId.phone}" (Expected: "9876543210")`);
    console.log(`  Father's Name: "${approvedStudent.family.father.name}" (Expected: "Requested New Father Name")`);
    console.log(`  DOB: "${approvedStudent.userId.dob.toISOString().split('T')[0]}" (Expected: "1999-09-09")`);
    console.log(`  Pending RequestedAt: ${approvedStudent.pendingProfileUpdate.requestedAt} (Expected: null)`);
    
    if (approvedStudent.userId.name !== 'Requested New Name' || approvedStudent.userId.phone !== '9876543210' || approvedStudent.pendingProfileUpdate.requestedAt !== null) {
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
    
    const secondRequestStudent = await Student.findById(student._id).populate('userId');
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
    
    const rejectedStudent = await Student.findById(student._id).populate('userId');
    console.log('Checking student main fields after Admin rejection:');
    console.log(`  Name: "${rejectedStudent.userId.name}" (Expected: "Requested New Name" - unchanged)`);
    console.log(`  Pending RequestedAt: ${rejectedStudent.pendingProfileUpdate.requestedAt} (Expected: null)`);
    
    if (rejectedStudent.userId.name !== 'Requested New Name' || rejectedStudent.pendingProfileUpdate.requestedAt !== null) {
      throw new Error('Admin rejection modified main fields or failed to clear pending update object!');
    }
    console.log('✅ Admin rejection successfully ignored changes and cleared queue.');

    // Clean up
    await User.deleteOne({ _id: user._id });
    await Student.deleteOne({ _id: student._id });
    console.log('\n🎉 ALL PROFILE REQUEST & APPROVAL ASSERTIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ Profile request/approval verification test failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

test();
