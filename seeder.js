require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Student = require('./models/Student');
const Teacher = require('./models/Teacher');
const Counsellor = require('./models/Counsellor');
const Course = require('./models/Course');
const Batch = require('./models/Batch');
const Lead = require('./models/Lead');
const LeadActivity = require('./models/LeadActivity');
const Fee = require('./models/Fee');
const Curriculum = require('./models/Curriculum');
const Progress = require('./models/Progress');
const Schedule = require('./models/Schedule');
const Message = require('./models/Message');
const DailyUpdate = require('./models/DailyUpdate');
const Assignment = require('./models/Assignment');
const Classroom = require('./models/Classroom');
const Holiday = require('./models/Holiday');
const LeaveRequest = require('./models/LeaveRequest');
const Attendance = require('./models/Attendance');
const connectDB = require('./config/db');
const Counter = require('./models/Counter');
const Expense = require('./models/Expense');
const RevenueTarget = require('./models/RevenueTarget');
const Announcement = require('./models/Announcement');
const Timetable = require('./models/Timetable');

async function seed() {
  await connectDB();
  
  console.log('🧹 Clearing database collections...');
  await User.deleteMany({});
  await Student.deleteMany({});
  await Teacher.deleteMany({});
  await Counsellor.deleteMany({});
  await Course.deleteMany({});
  await Batch.deleteMany({});
  await Lead.deleteMany({});
  await LeadActivity.deleteMany({});
  await Fee.deleteMany({});
  await Curriculum.deleteMany({});
  await Progress.deleteMany({});
  await Schedule.deleteMany({});
  await Message.deleteMany({});
  await DailyUpdate.deleteMany({});
  await Assignment.deleteMany({});
  await Holiday.deleteMany({});
  await LeaveRequest.deleteMany({});
  await Attendance.deleteMany({});
  await Classroom.deleteMany({});
  await Counter.deleteMany({});
  await Expense.deleteMany({});
  await RevenueTarget.deleteMany({});
  await Announcement.deleteMany({});
  await Timetable.deleteMany({});

  console.log('📚 Seeding 10 Courses with Modules & Topics...');
  const courseTemplates = [
    { name: 'Video Editing', code: 'VE', durationMonths: 3, fees: 25000 },
    { name: 'Digital Marketing', code: 'DM', durationMonths: 3, fees: 20000 },
    { name: 'Both (VE & DM)', code: 'BT', durationMonths: 6, fees: 45000 },
    { name: 'Graphic Design', code: 'GD', durationMonths: 3, fees: 18000 },
    { name: 'UI/UX Design', code: 'UI', durationMonths: 3, fees: 22000 },
    { name: 'Full Stack Development', code: 'FSD', durationMonths: 6, fees: 50000 },
    { name: 'Data Analytics', code: 'DA', durationMonths: 3, fees: 30000 },
    { name: 'Python Programming', code: 'PY', durationMonths: 2, fees: 12000 },
    { name: 'Motion Graphics', code: 'MG', durationMonths: 3, fees: 28000 },
    { name: 'Cyber Security', code: 'CS', durationMonths: 4, fees: 35000 }
  ];

  const courses = [];
  for (const c of courseTemplates) {
    const doc = await Course.create({
      name: c.name,
      code: c.code,
      durationMonths: c.durationMonths,
      fees: c.fees,
      modules: [
        {
          title: 'Module 1: Foundations',
          order: 1,
          topics: [
            { title: 'Core Concepts & Terminology', order: 1 },
            { title: 'Industry Best Practices', order: 2 },
            { title: 'Software & Tool Installation', order: 3 }
          ]
        },
        {
          title: 'Module 2: Practical Implementation',
          order: 2,
          topics: [
            { title: 'Working with Real Projects', order: 1 },
            { title: 'Intermediate Hands-on Labs', order: 2 },
            { title: 'Troubleshooting & Testing', order: 3 }
          ]
        },
        {
          title: 'Module 3: Advanced Concepts & Delivery',
          order: 3,
          topics: [
            { title: 'Performance Optimization', order: 1 },
            { title: 'Final Assessments & Evaluation', order: 2 }
          ]
        }
      ]
    });
    courses.push(doc);
  }

  console.log('🏫 Seeding 10 Classrooms...');
  const classrooms = await Classroom.create([
    { name: 'Room A (Video Suite)', capacity: 15, location: 'First Floor, Left Wing' },
    { name: 'Room B (Marketing Hub)', capacity: 25, location: 'First Floor, Right Wing' },
    { name: 'Room C (Resolve Lab)', capacity: 12, location: 'Second Floor, Room 202' },
    { name: 'Room D (Design Studio)', capacity: 20, location: 'Second Floor, Room 205' },
    { name: 'Room E (Web Lab)', capacity: 30, location: 'Ground Floor, Lab 101' },
    { name: 'Room F (Data Den)', capacity: 18, location: 'Ground Floor, Lab 102' },
    { name: 'Room G (Python Pod)', capacity: 15, location: 'Third Floor, Room 301' },
    { name: 'Room H (VFX Arena)', capacity: 22, location: 'Third Floor, Studio B' },
    { name: 'Room I (Cyber Cell)', capacity: 16, location: 'Fourth Floor, Room 405' },
    { name: 'Room J (Seminar Hall)', capacity: 50, location: 'Ground Floor, Auditorium' }
  ]);

  console.log('👑 Seeding default Admin...');
  const admin = await User.create({
    name: 'Vande Admin',
    email: 'admin@vandedigital.com',
    password: 'password123',
    role: 'admin',
    phone: '9999999999'
  });

  console.log('👥 Seeding 10 Teachers...');
  const teacherData = [
    { name: 'Rohan Sharma', email: 'rohan.teacher@gmail.com', phone: '8888888801', subject: 'Video Editing', qualification: 'M.Sc. in Film Editing', exp: 6 },
    { name: 'Priya Patel', email: 'priya.teacher@gmail.com', phone: '8888888802', subject: 'Digital Marketing', qualification: 'MBA in Marketing', exp: 8 },
    { name: 'Amit Verma', email: 'amit.teacher@gmail.com', phone: '8888888803', subject: 'Video Editing', qualification: 'BFA in Cinema Studies', exp: 4 },
    { name: 'Sneha Kapoor', email: 'sneha.teacher@gmail.com', phone: '8888888804', subject: 'Digital Marketing', qualification: 'MA in Communication', exp: 5 },
    { name: 'Gaurav Sen', email: 'gaurav.teacher@gmail.com', phone: '8888888805', subject: 'Digital Marketing', qualification: 'Certified Google Ads Spec', exp: 7 },
    { name: 'Vikram Malhotra', email: 'vikram.teacher@gmail.com', phone: '8888888806', subject: 'Graphic Design', qualification: 'M.Des in Graphic Design', exp: 6 },
    { name: 'Kavita Reddy', email: 'kavita.teacher@gmail.com', phone: '8888888807', subject: 'Full Stack Development', qualification: 'B.Tech in Computer Science', exp: 9 },
    { name: 'Manish Pandey', email: 'manish.teacher@gmail.com', phone: '8888888808', subject: 'Data Analytics', qualification: 'M.Stat in Data Science', exp: 5 },
    { name: 'Ananya Roy', email: 'ananya.teacher@gmail.com', phone: '8888888809', subject: 'UI/UX Design', qualification: 'B.Des in Interaction Design', exp: 4 },
    { name: 'Kunal Bahl', email: 'kunal.teacher@gmail.com', phone: '8888888810', subject: 'Cyber Security', qualification: 'Certified Ethical Hacker (CEH)', exp: 7 }
  ];

  const teachers = [];
  for (const t of teacherData) {
    const user = await User.create({
      name: t.name,
      email: t.email,
      password: 'password123',
      role: 'teacher',
      phone: t.phone
    });
    const teacherProfile = await Teacher.create({
      userId: user._id,
      subjects: [t.subject],
      qualification: t.qualification,
      experienceYears: t.exp
    });
    teachers.push(user);
  }

  console.log('🤝 Seeding 10 Counsellors...');
  const counsellorData = [
    { name: 'Anjali Verma', email: 'counsellor@gmail.com', phone: '7777777771' },
    { name: 'Karan Johar', email: 'karan.counsellor@gmail.com', phone: '7777777772' },
    { name: 'Pooja Hegde', email: 'pooja.counsellor@gmail.com', phone: '7777777773' },
    { name: 'Rahul Bose', email: 'rahul.counsellor@gmail.com', phone: '7777777774' },
    { name: 'Tanya Joshi', email: 'tanya.counsellor@gmail.com', phone: '7777777775' },
    { name: 'Kiara Sen', email: 'kiara.counsellor@gmail.com', phone: '7777777776' },
    { name: 'Sanya Gill', email: 'sanya.counsellor@gmail.com', phone: '7777777777' },
    { name: 'Dev Shah', email: 'dev.counsellor@gmail.com', phone: '7777777778' },
    { name: 'Rohit Roy', email: 'rohit.counsellor@gmail.com', phone: '7777777779' },
    { name: 'Shikha Goel', email: 'shikha.counsellor@gmail.com', phone: '7777777780' }
  ];

  const counsellors = [];
  for (const c of counsellorData) {
    const user = await User.create({
      name: c.name,
      email: c.email,
      password: 'password123',
      role: 'counsellor',
      phone: c.phone
    });
    await Counsellor.create({
      userId: user._id
    });
    counsellors.push(user);
  }

  console.log('🗂️ Seeding 12 Batches...');
  const batchTemplates = [
    { name: 'VE-09AM-A1', courseCode: 'VE', teachersIdx: [0, 2] },
    { name: 'VE-03PM-A1', courseCode: 'VE', teachersIdx: [0, 2] },
    { name: 'DM-11AM-A1', courseCode: 'DM', teachersIdx: [1, 3, 4] },
    { name: 'DM-05PM-A1', courseCode: 'DM', teachersIdx: [1, 3, 4] },
    { name: 'BT-09AM-A1', courseCode: 'BT', teachersIdx: [0, 1, 2, 3] },
    { name: 'GD-03PM-A1', courseCode: 'GD', teachersIdx: [5] },
    { name: 'GD-09AM-A1', courseCode: 'GD', teachersIdx: [5, 8] },
    { name: 'UI-11AM-A1', courseCode: 'UI', teachersIdx: [8, 5] },
    { name: 'UI-05PM-A1', courseCode: 'UI', teachersIdx: [8] },
    { name: 'FSD-09AM-A1', courseCode: 'FSD', teachersIdx: [6] },
    { name: 'DA-11AM-A1', courseCode: 'DA', teachersIdx: [7] },
    { name: 'CS-05PM-A1', courseCode: 'CS', teachersIdx: [9] }
  ];

  const batches = [];
  for (const b of batchTemplates) {
    const courseDoc = courses.find(c => c.code === b.courseCode);
    const batchTeachers = b.teachersIdx.map(idx => teachers[idx]._id);
    
    const batchDoc = await Batch.create({
      name: b.name,
      course: courseDoc._id,
      capacity: 25,
      teachers: batchTeachers,
      isActive: true,
      startDate: new Date(2024, 0, 15),
      endDate: new Date(2024, 0, 15 + courseDoc.durationMonths * 30)
    });
    batches.push(batchDoc);
  }

  console.log('🗓️ Seeding Historical Holidays (3 Years)...');
  const holidayTemplates = [
    { name: "New Year's Day", monthDay: "01-01", type: "public" },
    { name: "Republic Day", monthDay: "01-26", type: "public" },
    { name: "Independence Day", monthDay: "08-15", type: "public" },
    { name: "Gandhi Jayanti", monthDay: "10-02", type: "public" },
    { name: "Christmas Day", monthDay: "12-25", type: "festival" }
  ];

  const holidayDates = new Set();
  for (let year = 2023; year <= 2026; year++) {
    for (const h of holidayTemplates) {
      const dateStr = `${year}-${h.monthDay}`;
      await Holiday.create({ name: `${h.name} ${year}`, date: dateStr, type: h.type });
      holidayDates.add(dateStr);
    }
  }

  console.log('✉️ Seeding 12 Teacher Leave Requests...');
  const leaveRequests = [];
  for (let i = 0; i < 12; i++) {
    const t = teachers[i % teachers.length];
    const leave = await LeaveRequest.create({
      user: t._id,
      startDate: `2025-0${(i % 9) + 1}-10`,
      endDate: `2025-0${(i % 9) + 1}-12`,
      reason: `Family event / Personal health care review ${i + 1}`,
      status: i % 4 === 0 ? 'pending' : (i % 3 === 0 ? 'rejected' : 'approved')
    });
    leaveRequests.push(leave);
  }

  console.log('👨‍🎓 Seeding 45 Students with 3-Year intake timelines...');
  const studentNames = [
    'Siddharth Patel', 'Aarav Mehta', 'Ananya Roy', 'Vihaan Sharma', 'Diya Nair',
    'Ishaan Gupta', 'Kiara Sen', 'Kabir Das', 'Meera Rao', 'Aditya Mishra',
    'Riya Kapoor', 'Arjun Saxena', 'Sanya Gill', 'Dev Shah', 'Tanya Joshi',
    'Rohan Bajaj', 'Isha Singhal', 'Rahul Bose', 'Sneha Reddy', 'Vivek Dubey',
    'Neha Choudhury', 'Yash Singhania', 'Aditi Kulkarni', 'Manish Pandey', 'Prisha Desai',
    'Abhishek Kumar', 'Shreya Ghoshal', 'Nikhil Kamath', 'Kriti Sanon', 'Kunal Bahl',
    'Rajiv Bajaj', 'Geeta Johar', 'Sonam Kapoor', 'Ranbir Kapoor', 'Katrina Kaif',
    'Deepika Padukone', 'Ranveer Singh', 'Alia Bhatt', 'Sid Malhotra', 'Varun Dhawan',
    'Shraddha Kapoor', 'Tiger Shroff', 'Karthik Aryan', 'Sara Ali Khan', 'Janhvi Kapoor'
  ];

  const studentList = [];

  for (let i = 0; i < studentNames.length; i++) {
    const name = studentNames[i];
    const email = i === 0 ? 'student@gmail.com' : `${name.toLowerCase().replace(/ /g, '.')}@gmail.com`;
    
    // Distribute students across batches
    const batchDoc = batches[i % batches.length];
    const courseDoc = courses.find(c => c._id.toString() === batchDoc.course.toString());
    
    let enrollmentDate;
    let status = 'active';
    let feedback = { submitted: false };
    
    if (i < 15) {
      // Completed students (2023 or early 2024 intakes)
      enrollmentDate = new Date(2023, 2 + (i % 8), 10 + i);
      status = 'complete';
      const durationMonths = courseDoc.durationMonths || 3;
      const completionDate = new Date(enrollmentDate);
      completionDate.setMonth(completionDate.getMonth() + durationMonths);

      feedback = {
        submitted: true,
        teacherRating: 5 - (i % 2),
        contentRating: 4 + (i % 2),
        facilitiesRating: 5,
        comments: 'Outstanding practical reviews, extremely professional teachers.',
        submittedAt: completionDate
      };
    } else if (i < 35) {
      // Active students
      enrollmentDate = new Date(2025, 4 + (i % 6), 5 + i);
      status = 'active';
    } else {
      // Dropped students
      enrollmentDate = new Date(Date.now() - (i * 3 * 24 * 60 * 60 * 1000));
      status = 'drop';
    }

    const fees_total = courseDoc.fees;
    const discount = i % 5 === 0 ? 2000 : 0;
    const netFees = fees_total - discount;
    
    let fees_paid = 0;
    if (status === 'complete') {
      fees_paid = netFees;
    } else if (status === 'active') {
      fees_paid = Math.floor(netFees / (1.5 + (i % 3)));
    } else {
      fees_paid = Math.floor(netFees * 0.25); // Paid registration only
    }

    // Assign teacher from the batch
    const teacherId = batchDoc.teachers[i % batchDoc.teachers.length];
    const counsellorId = counsellors[i % counsellors.length]._id;

    const user = await User.create({
      name,
      email,
      password: 'password123',
      role: 'student',
      phone: `98765432${String(i).padStart(2, '0')}`,
      status
    });

    const completionDateVal = new Date(enrollmentDate);
    completionDateVal.setMonth(completionDateVal.getMonth() + (courseDoc.durationMonths || 3));

    const student = await Student.create({
      userId: user._id,
      counsellor: counsellorId,
      teacher: teacherId,
      course: courseDoc._id,
      batch: batchDoc._id,
      enrollmentDate,
      fees_total,
      fees_paid,
      family: {
        father: { name: 'Father of ' + name, phone: '9988776655' },
        mother: { name: 'Mother of ' + name, phone: '9988776644' },
        guardian: { name: 'Guardian of ' + name, relation: 'Uncle', phone: '9988776633' }
      },
      documents: {
        profilePic: null,
        idProof: i % 3 === 0 ? `/uploads/dummy_id_${i}.jpg` : null
      },
      idVerified: i % 3 === 0,
      feedback,
      statusHistory: [
        { status: 'active', changedBy: admin._id, date: enrollmentDate, reason: 'Initial intake' },
        ...(status === 'complete' ? [{ status: 'complete', changedBy: admin._id, date: completionDateVal, reason: 'Completed requirements' }] : []),
        ...(status === 'drop' ? [{ status: 'drop', changedBy: admin._id, date: new Date(enrollmentDate.getTime() + 45 * 24 * 60 * 60 * 1000), reason: 'Unavoidable circumstances' }] : [])
      ]
    });

    studentList.push(student);

    // Create Fee ledger record
    const payments = [];
    if (fees_paid > 0) {
      const numInstallments = status === 'complete' ? 3 : 1;
      const amountPerInst = Math.floor(fees_paid / numInstallments);
      for (let j = 0; j < numInstallments; j++) {
        payments.push({
          amount: amountPerInst,
          method: j % 2 === 0 ? 'UPI' : 'Bank Transfer',
          transactionId: `TXN889${i}${j}`,
          note: `Installment ${j + 1}`,
          receivedBy: admin._id,
          paidAt: new Date(enrollmentDate.getTime() + j * 30 * 24 * 60 * 60 * 1000)
        });
      }
    }

    await Fee.create({
      student: student._id,
      course: courseDoc._id,
      batch: batchDoc._id,
      totalAmount: fees_total,
      paidAmount: fees_paid,
      discount,
      discountReason: discount > 0 ? 'Scholastic intake grant' : '',
      dueDate: new Date(enrollmentDate.getTime() + 90 * 24 * 60 * 60 * 1000),
      courseDurationMonths: courseDoc.durationMonths,
      payments,
      createdAt: enrollmentDate
    });
  }

  console.log('📈 Seeding Student Progress records...');
  for (const s of studentList) {
    await Progress.create({
      student: s._id,
      course: s.course,
      batch: s.batch,
      teacher: s.teacher,
      testResults: [
        { testName: 'Mid-term Assessment', score: 80 + Math.floor(Math.random() * 18), totalMarks: 100, date: s.enrollmentDate.toISOString().split('T')[0], remarks: 'Excellent performance.' },
        { testName: 'Final Theory Exam', score: 75 + Math.floor(Math.random() * 22), totalMarks: 100, date: new Date(s.enrollmentDate.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], remarks: 'Well prepared.' }
      ],
      teacherRemark: 'Good progress overall, highly participative in classroom tasks.'
    });
  }

  console.log('📈 Seeding 30 CRM Leads and separate LeadActivity timelines...');
  const leadNames = [
    'Vikram Malhotra', 'Siddarth Roy', 'Pooja Sharma', 'Abhay Deol', 'Nisha Rawat',
    'Rajesh Koothrapali', 'Howard Wolowitz', 'Leonard Hofstadter', 'Penny Hofstadter', 'Sheldon Cooper',
    'Monica Geller', 'Chandler Bing', 'Joey Tribbiani', 'Rachel Green', 'Phoebe Buffay',
    'Bruce Wayne', 'Clark Kent', 'Diana Prince', 'Barry Allen', 'Hal Jordan',
    'Tony Stark', 'Steve Rogers', 'Natasha Romanoff', 'Bruce Banner', 'Clint Barton',
    'Wanda Maximoff', 'Peter Parker', 'Stephen Strange', 'Sam Wilson', 'Bucky Barnes'
  ];
  const leadSources = ['Walk-in', 'Website', 'Referral', 'Instagram', 'Advertisement', 'WhatsApp', 'Other'];
  const leadStatuses = ['new', 'contacted', 'mentorship_scheduled', 'admission_completed', 'lost'];
  const lostReasons = ['Fees Issue', 'No Response', 'Joined Another Institute', 'Financial Issue', 'Other'];
  const leadCategories = ['hot', 'warm', 'cold'];
  const automationProviders = ['instagram', 'facebook', 'website', 'whatsapp', 'zapier'];

  for (let i = 0; i < leadNames.length; i++) {
    const status = leadStatuses[i % leadStatuses.length];
    const assignedCounsellor = counsellors[i % counsellors.length]._id;
    const createdDate = new Date(Date.now() - (15 * i * 24 * 60 * 60 * 1000));
    const courseDoc = courses[i % courses.length];
    const category = leadCategories[i % leadCategories.length];
    const leadType = i % 2 === 0 ? 'manual' : 'automation';
    
    let lostReason = '';
    if (status === 'lost') {
      lostReason = lostReasons[i % lostReasons.length];
    }
    
    let automation = {
      provider: 'none',
      externalLeadId: '',
      campaignName: '',
      formName: '',
      adName: '',
      rawPayload: null
    };
    
    if (leadType === 'automation') {
      automation = {
        provider: automationProviders[i % automationProviders.length],
        externalLeadId: `ext_id_${i}`,
        campaignName: `Campaign - ${courseDoc.code} Promo`,
        formName: `Lead Form - ${courseDoc.name}`,
        adName: `Ad Creative - ${i}`,
        rawPayload: { generatedAt: createdDate, platform: 'Meta Ads' }
      };
    }

    const lead = await Lead.create({
      name: leadNames[i],
      phone: `90909090${String(i).padStart(2, '0')}`,
      email: `${leadNames[i].toLowerCase().replace(/ /g, '.')}@gmail.com`,
      interestedCourse: courseDoc._id,
      source: leadSources[i % leadSources.length],
      leadType,
      category,
      status: status,
      assignedTo: assignedCounsellor,
      nextFollowUpAt: status !== 'admission_completed' && status !== 'lost' ? new Date(Date.now() + ((i - 2) * 24 * 60 * 60 * 1000)) : null,
      convertedStudent: status === 'admission_completed' ? studentList[i % studentList.length]._id : null,
      convertedAt: status === 'admission_completed' ? new Date(createdDate.getTime() + 72 * 3600000) : null,
      lostReason,
      lostNote: status === 'lost' ? 'Prospect mentioned they did not have time or funds for intake.' : '',
      automation,
      createdAt: createdDate
    });

    // Seed activities in LeadActivity
    await LeadActivity.create({
      lead: lead._id,
      type: 'lead_created',
      title: 'Lead Registered',
      note: `Prospect joined via ${lead.source}.`,
      counsellor: assignedCounsellor,
      doneBy: assignedCounsellor,
      createdAt: createdDate
    });

    if (status !== 'new') {
      await LeadActivity.create({
        lead: lead._id,
        type: 'status_changed',
        title: 'Status: Contacted',
        note: `Contacted lead. Discussed course parameters.`,
        counsellor: assignedCounsellor,
        doneBy: assignedCounsellor,
        oldStatus: 'new',
        newStatus: 'contacted',
        createdAt: new Date(createdDate.getTime() + 24 * 3600000)
      });
    }

    if (status === 'mentorship_scheduled' || status === 'admission_completed') {
      await LeadActivity.create({
        lead: lead._id,
        type: 'mentorship_scheduled',
        title: 'Mentorship Scheduled',
        note: `Scheduled guidance demo on ${courseDoc.name}.`,
        counsellor: assignedCounsellor,
        doneBy: assignedCounsellor,
        createdAt: new Date(createdDate.getTime() + 48 * 3600000)
      });
    }

    if (status === 'admission_completed') {
      await LeadActivity.create({
        lead: lead._id,
        type: 'converted',
        title: 'Admission Finalized',
        note: `Registered student, set up payment milestones.`,
        counsellor: assignedCounsellor,
        doneBy: assignedCounsellor,
        createdAt: new Date(createdDate.getTime() + 72 * 3600000)
      });
    } else if (status === 'lost') {
      await LeadActivity.create({
        lead: lead._id,
        type: 'lost',
        title: 'Intake Deferred',
        note: `Student opted for another track. Marked lost.`,
        counsellor: assignedCounsellor,
        doneBy: assignedCounsellor,
        createdAt: new Date(createdDate.getTime() + 72 * 3600000)
      });
    }
  }

  console.log('📚 Seeding Assignments & Submissions...');
  for (const b of batches) {
    const courseDoc = courses.find(c => c._id.toString() === b.course.toString());
    const primaryTeacher = b.teachers[0];

    for (let j = 1; j <= 5; j++) {
      let dueDate;
      if (j <= 3) {
        dueDate = new Date(Date.now() - (j * 45 * 24 * 60 * 60 * 1000));
      } else {
        dueDate = new Date(Date.now() + ((j - 3) * 10 * 24 * 60 * 60 * 1000));
      }

      const creationDate = new Date(dueDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      const submissions = [];

      const batchStudents = studentList.filter(s => s.batch.toString() === b._id.toString() && s.enrollmentDate <= creationDate);

      batchStudents.forEach((s, idx) => {
        if (dueDate < new Date()) {
          if (idx % 7 === 0) return; // Didn't submit
          const isLate = idx % 11 === 0;
          const isGraded = idx % 3 !== 0;

          submissions.push({
            student: s._id,
            fileUrl: `/uploads/submission_${s._id}_${j}.zip`,
            fileName: `homework_project_${j}.zip`,
            note: isLate ? 'Late submission due to personal emergency.' : 'Completed all exercises.',
            submittedAt: isLate ? new Date(dueDate.getTime() + 12 * 3600000) : new Date(creationDate.getTime() + 4 * 24 * 60 * 60 * 1000),
            marks: isGraded ? (75 + (idx % 20)) : null,
            feedback: isGraded ? 'Well structured work, code looks clean.' : '',
            status: isGraded ? 'graded' : (isLate ? 'late' : 'submitted')
          });
        } else {
          if (idx % 3 === 0) {
            submissions.push({
              student: s._id,
              fileUrl: `/uploads/submission_${s._id}_${j}.zip`,
              fileName: `homework_project_${j}.zip`,
              note: 'Submitting ahead of deadline.',
              submittedAt: new Date(creationDate.getTime() + 2 * 24 * 60 * 60 * 1000),
              marks: null,
              feedback: '',
              status: 'submitted'
            });
          }
        }
      });

      await Assignment.create({
        title: `${courseDoc.name} - Practice Assignment ${j}`,
        description: `This is the practice assignment task ${j} designed to test batch knowledge in ${courseDoc.name}.`,
        course: b.course,
        batch: b._id,
        teacher: primaryTeacher,
        dueDate,
        totalMarks: 100,
        submissions,
        isActive: true,
        createdAt: creationDate
      });
    }
  }

  console.log('⏰ Seeding 12 Weekly Timetable Templates...');
  for (const b of batches) {
    const slots = [
      { dayOfWeek: 'Monday', teacher: b.teachers[0], classroom: classrooms[batches.indexOf(b) % classrooms.length]._id, startTime: '09:00 AM', endTime: '10:30 AM', note: 'Core theory session' },
      { dayOfWeek: 'Wednesday', teacher: b.teachers[0], classroom: classrooms[batches.indexOf(b) % classrooms.length]._id, startTime: '09:00 AM', endTime: '10:30 AM', note: 'Studio lab work' },
      { dayOfWeek: 'Friday', teacher: b.teachers[0], classroom: classrooms[batches.indexOf(b) % classrooms.length]._id, startTime: '09:00 AM', endTime: '10:30 AM', note: 'Project evaluation and grading' }
    ];

    await Timetable.create({
      course: b.course,
      batch: b._id,
      startDate: new Date(2024, 0, 15),
      endDate: new Date(2026, 11, 31),
      slots
    });
  }

  console.log('🗓️ Seeding Class Schedules & Attendance (Historical)...');
  const currentDate = new Date();
  
  for (const b of batches) {
    const primaryTeacher = b.teachers[0];
    const batchStudents = studentList.filter(s => s.batch.toString() === b._id.toString());
    if (batchStudents.length === 0) continue;

    // Find earliest enrollment date for students in this batch
    const earliestEnroll = new Date(Math.min(...batchStudents.map(s => s.enrollmentDate)));
    let runner = new Date(earliestEnroll);
    
    // Only generate ~30 schedules per batch to keep execution speed realistic
    let schedulesCreated = 0;
    
    while (runner < currentDate && schedulesCreated < 30) {
      const dayOfWeek = runner.getDay();
      const dateStr = runner.toISOString().split('T')[0];
      
      // Seed on Mon/Wed/Fri (excluding holidays)
      if ((dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) && !holidayDates.has(dateStr)) {
        const schedule = await Schedule.create({
          course: b.course,
          batch: b._id,
          teacher: primaryTeacher,
          classroom: classrooms[batches.indexOf(b) % classrooms.length]._id,
          date: dateStr,
          startTime: '09:00 AM',
          endTime: '10:30 AM',
          status: 'completed',
          note: courses.find(c => c._id.toString() === b.course.toString()).name
        });

        // Seed Attendance for this schedule
        for (const s of batchStudents) {
          if (s.enrollmentDate <= runner) {
            const isCompletedAtDate = s.statusHistory.some(sh => sh.status === 'complete' && runner > sh.date);
            const isDroppedAtDate = s.statusHistory.some(sh => sh.status === 'drop' && runner > sh.date);
            if (isCompletedAtDate || isDroppedAtDate) continue;

            const rand = Math.random();
            const status = rand > 0.88 ? 'absent' : (rand > 0.78 ? 'late' : 'present');

            await Attendance.create({
              student: s._id,
              teacher: primaryTeacher,
              course: b.course,
              batch: b._id,
              date: dateStr,
              status,
              note: status !== 'present' ? 'Automated daily register mark' : ''
            });
          }
        }

        // Daily Class Update
        const courseDoc = courses.find(c => c._id.toString() === b.course.toString());
        const firstModule = courseDoc.modules[0];
        const coveredTopics = firstModule ? [{
          moduleId: firstModule._id,
          topicId: firstModule.topics[0]._id,
          title: firstModule.topics[0].title
        }] : [];

        await DailyUpdate.create({
          title: `Session covered: ${firstModule ? firstModule.title : 'Overview'}`,
          course: b.course,
          batch: b._id,
          content: `Lectured on foundational concepts. Done practical exercises.`,
          homework: `Solve practice sheet ${schedulesCreated + 1}`,
          teacher: primaryTeacher,
          date: dateStr,
          coveredTopics
        });

        schedulesCreated++;
      }
      runner.setDate(runner.getDate() + 2); // Jump forward
    }
  }

  console.log('📚 Seeding Curriculums for all Batches...');
  for (const b of batches) {
    const primaryTeacher = b.teachers[0];
    const courseDoc = courses.find(c => c._id.toString() === b.course.toString());
    
    const completedTopics = [];
    const firstModule = courseDoc.modules[0];
    if (firstModule && primaryTeacher) {
      firstModule.topics.forEach(t => {
        completedTopics.push({
          moduleId: firstModule._id,
          topicId: t._id,
          completedBy: primaryTeacher,
          completedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          note: 'Covered in detail with classroom activities.'
        });
      });
    }

    await Curriculum.create({
      course: b.course,
      batch: b._id,
      teacher: primaryTeacher,
      completedTopics,
      description: `Curriculum tracking for batch ${b.name}`
    });
  }

  console.log('📣 Seeding 10 Announcements...');
  const announcementTemplates = [
    { title: 'Welcome to Vande Academy', content: 'We are thrilled to start the new academic year. Check your timetables.', type: 'all' },
    { title: 'DaVinci Resolve License Access', content: 'Students can request Resolve studio licenses from the admin panel.', type: 'course', courseIdx: 0 },
    { title: 'Google Analytics GA4 Workshop', content: 'Join the free workshop on Google Analytics tracking this Saturday.', type: 'course', courseIdx: 1 },
    { title: 'Timetable Adjustment', content: 'Friday class timings are adjusted to 10:00 AM this week.', type: 'batch', batchIdx: 0 },
    { title: 'Leave Application Reminder', content: 'Teachers must apply for leaves at least 3 days in advance.', type: 'role', role: 'teacher' },
    { title: 'Intake Target Reviews', content: 'Counsellors are requested to update lead records by every Friday.', type: 'role', role: 'counsellor' },
    { title: 'Campus Maintenance Work', content: 'Power grid maintenance scheduled for Sunday. Campus will be closed.', type: 'all' },
    { title: 'Placement Drive registrations', content: 'Registrations are open for the upcoming digital agency placement drive.', type: 'all' },
    { title: 'Final Project Submission Guidelines', content: 'Ensure all projects are bundled correctly before submitting.', type: 'role', role: 'student' },
    { title: 'Graphic Design Software Access', content: 'Adobe Creative Suite licenses are now available for student logins.', type: 'course', courseIdx: 3 }
  ];

  for (const a of announcementTemplates) {
    let course = null;
    let batch = null;
    if (a.type === 'course') course = courses[a.courseIdx]._id;
    if (a.type === 'batch') batch = batches[a.batchIdx]._id;

    const attachments = a.title.includes('Adobe') || a.title.includes('DaVinci') ? [
      { url: '/uploads/software_guide.pdf', fileName: 'software_guide.pdf', fileType: 'application/pdf', fileSize: 1048576 }
    ] : [];

    await Announcement.create({
      title: a.title,
      content: a.content,
      attachments,
      createdBy: admin._id,
      audienceType: a.type === 'role' ? 'role' : (a.type === 'all' ? 'all' : a.type),
      course,
      batch,
      role: a.type === 'role' ? a.role : ''
    });
  }

  console.log('✉️ Seeding 25 Messages (Inbox/Outbox communication)...');
  for (let i = 0; i < 25; i++) {
    const studentUser = studentList[i % studentList.length].userId;
    const teacherUser = teachers[i % teachers.length]._id;
    const counsellorUser = counsellors[i % counsellors.length]._id;

    // Student to Teacher query
    await Message.create({
      sender: studentUser,
      recipient: teacherUser,
      content: `Hello Sir, regarding assignment ${ (i % 3) + 1 }, could you explain the evaluation criteria?`,
      read: i % 2 === 0,
      readAt: i % 2 === 0 ? new Date(Date.now() - i * 3600000) : null
    });

    // Counsellor to Student query
    await Message.create({
      sender: counsellorUser,
      recipient: studentUser,
      content: `Hello, please verify your uploaded Aadhaar card ID proof so we can finalize registration.`,
      read: i % 3 === 0,
      readAt: i % 3 === 0 ? new Date(Date.now() - i * 7200000) : null
    });
  }

  console.log('💰 Seeding Financial Targets & Expenses (3 Years)...');
  const startYear = 2023;
  const endYear = 2026;
  const monthsList = [];
  for (let year = startYear; year <= endYear; year++) {
    const maxMonth = (year === 2026) ? 6 : 12;
    for (let month = 1; month <= maxMonth; month++) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      monthsList.push(monthStr);
    }
  }

  for (const m of monthsList) {
    const targetAmt = 120000 + Math.floor(Math.random() * 80000);
    await RevenueTarget.create({
      month: m,
      amount: targetAmt
    });

    await Expense.create({
      month: m,
      category: 'rent',
      amount: 35000,
      description: 'Monthly classroom & office space rent',
      paymentMethod: 'Bank Transfer',
      loggedBy: admin._id,
      date: new Date(`${m}-01`)
    });

    const elecAmount = 5000 + Math.floor(Math.random() * 4500);
    await Expense.create({
      month: m,
      category: 'electricity',
      amount: elecAmount,
      description: 'Electricity utility bill',
      paymentMethod: 'UPI',
      loggedBy: admin._id,
      date: new Date(`${m}-10`)
    });

    await Expense.create({
      month: m,
      category: 'staff',
      amount: 60000,
      description: 'Salaries for teaching assistant and admin support staff',
      paymentMethod: 'Bank Transfer',
      loggedBy: admin._id,
      date: new Date(`${m}-05`)
    });

    const miscAmount = 1500 + Math.floor(Math.random() * 5000);
    await Expense.create({
      month: m,
      category: 'miscellaneous',
      amount: miscAmount,
      description: 'Internet, printing, supplies, refreshments',
      paymentMethod: Math.random() > 0.5 ? 'Cash' : 'Card',
      loggedBy: admin._id,
      date: new Date(`${m}-15`)
    });
  }

  console.log('✅ 3-Year historical database seeded successfully with highly realistic data!');
  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch(err => {
    console.error('❌ Seeder script failed:', err);
    process.exit(1);
  });
}

module.exports = seed;
