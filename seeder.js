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
  
  console.log('📚 Seeding Courses with Modules & Topics...');
  const courseVE = await Course.create({
    name: 'Video Editing',
    code: 'VE',
    durationMonths: 3,
    fees: 25000,
    modules: [
      {
        title: 'Introduction & Interface',
        order: 1,
        topics: [
          { title: 'Project Setup & Organization', order: 1 },
          { title: 'Source Panels & Timeline navigation', order: 2 },
          { title: 'Keyboard Shortcuts & Layouts', order: 3 }
        ]
      },
      {
        title: 'Basic Editing & Cutting',
        order: 2,
        topics: [
          { title: 'Three-point editing', order: 1 },
          { title: 'Roll, Ripple & Slip tools', order: 2 },
          { title: 'Working with audio tracks', order: 3 }
        ]
      },
      {
        title: 'Color Grading & Audio',
        order: 3,
        topics: [
          { title: 'Color spaces & Lumetri scopes', order: 1 },
          { title: 'Basic grading & LUTs', order: 2 },
          { title: 'Noise reduction & audio leveling', order: 3 }
        ]
      }
    ]
  });

  const courseDM = await Course.create({
    name: 'Digital Marketing',
    code: 'DM',
    durationMonths: 3,
    fees: 20000,
    modules: [
      {
        title: 'Search Engine Optimization',
        order: 1,
        topics: [
          { title: 'Keyword Research & Competitor analysis', order: 1 },
          { title: 'On-Page SEO & Metadata', order: 2 },
          { title: 'Technical SEO & Site audits', order: 3 }
        ]
      },
      {
        title: 'Social Media & Brand Building',
        order: 2,
        topics: [
          { title: 'Social media strategy & calendar planning', order: 1 },
          { title: 'Content creation for Instagram/Facebook', order: 2 },
          { title: 'Community management & organic growth', order: 3 }
        ]
      },
      {
        title: 'Paid Campaigns & Analytics',
        order: 3,
        topics: [
          { title: 'Google Search Ads setup', order: 1 },
          { title: 'Meta Ads Manager & targeting', order: 2 },
          { title: 'Google Analytics (GA4) reporting', order: 3 }
        ]
      }
    ]
  });

  const courseBoth = await Course.create({
    name: 'Both',
    code: 'BT',
    durationMonths: 6,
    fees: 45000,
    modules: [
      ...courseVE.modules,
      ...courseDM.modules
    ]
  });

  console.log('🏫 Seeding Classrooms...');
  const classrooms = await Classroom.create([
    { name: 'Room A (Video Suite)', capacity: 15, location: 'First Floor, Left Wing' },
    { name: 'Room B (Marketing Hub)', capacity: 25, location: 'First Floor, Right Wing' },
    { name: 'Room C (Resolve Lab)', capacity: 12, location: 'Second Floor, Room 202' }
  ]);
  
  console.log('👑 Seeding default Admin...');
  const admin = await User.create({
    name: 'Vande Admin',
    email: 'admin@vandedigital.com',
    password: 'password123',
    role: 'admin',
    phone: '9999999999'
  });
  
  console.log('👥 Seeding Teachers...');
  const teacherData = [
    {
      name: 'Rohan Sharma',
      email: 'rohan.teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888801',
      subject: 'Video Editing',
      qualification: 'M.Sc. in Film Editing & VFX',
      experienceYears: 6
    },
    {
      name: 'Priya Patel',
      email: 'priya.teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888802',
      subject: 'Digital Marketing',
      qualification: 'MBA in Marketing, 8+ Yrs Corporate Experience',
      experienceYears: 8
    },
    {
      name: 'Amit Verma',
      email: 'amit.teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888803',
      subject: 'Video Editing',
      qualification: 'BFA in Cinema Studies',
      experienceYears: 4
    },
    {
      name: 'Sneha Kapoor',
      email: 'sneha.teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888804',
      subject: 'Digital Marketing',
      qualification: 'MA in Journalism & Communication',
      experienceYears: 5
    },
    {
      name: 'Gaurav Sen',
      email: 'gaurav.teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888805',
      subject: 'Digital Marketing',
      qualification: 'Certified Google Ads Specialist',
      experienceYears: 7
    },
    {
      name: 'Default Teacher',
      email: 'teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888888',
      subject: 'Video Editing',
      qualification: 'Lead Faculty',
      experienceYears: 10
    }
  ];
  
  const teachers = [];
  for (const t of teacherData) {
    const user = await User.create({
      name: t.name,
      email: t.email,
      password: t.password,
      role: t.role,
      phone: t.phone
    });
    await Teacher.create({
      userId: user._id,
      subjects: [t.subject],
      qualification: t.qualification,
      experienceYears: t.experienceYears
    });
    teachers.push(user);
  }

  console.log('🤝 Seeding Counsellors...');
  const counsellorData = [
    {
      name: 'Anjali Verma',
      email: 'counsellor@gmail.com',
      password: 'password123',
      role: 'counsellor',
      phone: '7777777771'
    },
    {
      name: 'Karan Johar',
      email: 'karan.counsellor@gmail.com',
      password: 'password123',
      role: 'counsellor',
      phone: '7777777772'
    },
    {
      name: 'Pooja Hegde',
      email: 'pooja.counsellor@gmail.com',
      password: 'password123',
      role: 'counsellor',
      phone: '7777777773'
    }
  ];

  const counsellors = [];
  for (const c of counsellorData) {
    const user = await User.create(c);
    await Counsellor.create({
      userId: user._id
    });
    counsellors.push(user);
  }

  console.log('🗂️ Seeding Batches...');
  const allBatchNames = [
    'VE-09AM-A1', 'VE-11AM-A1', 'VE-03PM-A1', 'VE-05PM-A1',
    'DM-09AM-A1', 'DM-11AM-A1', 'DM-03PM-A1', 'DM-05PM-A1'
  ];
  const batches = [];
  for (const name of allBatchNames) {
    const course = name.startsWith('VE-') ? courseVE : courseDM;
    const batchTeachers = name.startsWith('VE-') 
      ? [teachers[0]._id, teachers[2]._id, teachers[5]._id]
      : [teachers[1]._id, teachers[3]._id, teachers[4]._id];
    
    const batch = await Batch.create({
      name,
      course: course._id,
      capacity: 20,
      teachers: batchTeachers,
      isActive: true
    });
    batches.push(batch);
  }

  console.log('🗓️ Seeding Historical Holidays (3 Years)...');
  const holidayTemplates = [
    { name: "New Year's Day", monthDay: "01-01" },
    { name: "Republic Day", monthDay: "01-26" },
    { name: "Independence Day", monthDay: "08-15" },
    { name: "Gandhi Jayanti", monthDay: "10-02" },
    { name: "Christmas Day", monthDay: "12-25" }
  ];

  const holidayDates = new Set();
  for (let year = 2023; year <= 2026; year++) {
    for (const h of holidayTemplates) {
      const dateStr = `${year}-${h.monthDay}`;
      await Holiday.create({ name: `${h.name} ${year}`, date: dateStr });
      holidayDates.add(dateStr);
    }
  }

  console.log('✉️ Seeding Teacher Leave History...');
  const leaveRequests = [
    {
      user: teachers[0]._id,
      startDate: "2024-04-10",
      endDate: "2024-04-12",
      reason: "Family wedding event in hometown",
      status: "approved"
    },
    {
      user: teachers[1]._id,
      startDate: "2025-02-15",
      endDate: "2025-02-18",
      reason: "Medical leave due to viral fever",
      status: "approved"
    },
    {
      user: teachers[2]._id,
      startDate: "2025-06-20",
      endDate: "2025-06-22",
      reason: "Urgent personal work",
      status: "rejected"
    },
    {
      user: teachers[3]._id,
      startDate: "2026-03-01",
      endDate: "2026-03-03",
      reason: "Dental operation treatment recovery",
      status: "approved"
    }
  ];

  for (const leave of leaveRequests) {
    await LeaveRequest.create(leave);
  }

  console.log('👨‍🎓 Seeding Students with 3-Year intake timelines...');
  const studentNames = [
    'Siddharth Patel', 'Aarav Mehta', 'Ananya Roy', 'Vihaan Sharma', 'Diya Nair',
    'Ishaan Gupta', 'Kiara Sen', 'Kabir Das', 'Meera Rao', 'Aditya Mishra',
    'Riya Kapoor', 'Arjun Saxena', 'Sanya Gill', 'Dev Shah', 'Tanya Joshi',
    'Rohan Bajaj', 'Isha Singhal', 'Rahul Bose', 'Sneha Reddy', 'Vivek Dubey',
    'Neha Choudhury', 'Yash Singhania', 'Aditi Kulkarni', 'Manish Pandey', 'Prisha Desai',
    'Abhishek Kumar', 'Shreya Ghoshal', 'Nikhil Kamath', 'Kriti Sanon', 'Kunal Bahl'
  ];

  const courses = ['Video Editing', 'Digital Marketing', 'Both'];
  const possibleBatches = {
    'Video Editing': ['VE-09AM-A1', 'VE-11AM-A1', 'VE-03PM-A1', 'VE-05PM-A1'],
    'Digital Marketing': ['DM-09AM-A1', 'DM-11AM-A1', 'DM-03PM-A1', 'DM-05PM-A1'],
    'Both': ['VE-09AM-A1', 'DM-03PM-A1']
  };

  const studentList = [];

  for (let i = 0; i < studentNames.length; i++) {
    const name = studentNames[i];
    const email = i === 0 ? 'student@gmail.com' : `${name.toLowerCase().replace(/ /g, '.')}@gmail.com`;
    const courseName = i === 0 ? 'Video Editing' : courses[i % courses.length];
    const selectedCourse = courseName === 'Video Editing' ? courseVE : (courseName === 'Digital Marketing' ? courseDM : courseBoth);
    const possibleBatchList = possibleBatches[courseName];
    const batch = possibleBatchList[i % possibleBatchList.length];

    let enrollmentDate;
    let status = 'active';
    let feedback = { submitted: false };
    
    if (i < 10) {
      enrollmentDate = new Date(2023, 2 + (i % 8), 10 + i);
      status = 'complete';
      const durationMonths = selectedCourse.durationMonths || 3;
      const completionDate = new Date(enrollmentDate);
      completionDate.setMonth(completionDate.getMonth() + durationMonths);

      feedback = {
        submitted: true,
        teacherRating: 5,
        contentRating: 4,
        facilitiesRating: 5,
        comments: 'Excellent program! Really boosted my professional skillsets.',
        submittedAt: completionDate
      };
    } else if (i < 20) {
      enrollmentDate = new Date(2024, 4 + (i % 6), 5 + i);
      status = (i % 2 === 0) ? 'complete' : 'active';
      if (status === 'complete') {
        const durationMonths = selectedCourse.durationMonths || 3;
        const completionDate = new Date(enrollmentDate);
        completionDate.setMonth(completionDate.getMonth() + durationMonths);

        feedback = {
          submitted: true,
          teacherRating: 4,
          contentRating: 5,
          facilitiesRating: 4,
          comments: 'Loved the hands-on project reviews.',
          submittedAt: completionDate
        };
      }
    } else {
      enrollmentDate = new Date(Date.now() - (i * 3 * 24 * 60 * 60 * 1000));
      status = (i === 24) ? 'drop' : 'active';
    }

    const fees_total = courseName === 'Both' ? 45000 : courseName === 'Video Editing' ? 25000 : 20000;
    const discount = i % 5 === 0 ? 3000 : 0;
    const netFees = fees_total - discount;
    
    let fees_paid = 0;
    if (status === 'complete') {
      fees_paid = netFees;
    } else if (status === 'active') {
      fees_paid = Math.floor(netFees / (1.5 + (i % 3)));
    }

    let assignedTeacher;
    if (batch.startsWith('VE-')) {
      const veTeachers = [teachers[0], teachers[2], teachers[5]];
      assignedTeacher = veTeachers[i % veTeachers.length];
    } else {
      const dmTeachers = [teachers[1], teachers[3], teachers[4]];
      assignedTeacher = dmTeachers[i % dmTeachers.length];
    }
    const assignedCounsellor = counsellors[i % counsellors.length];

    const user = await User.create({
      name,
      email,
      password: 'password123',
      role: 'student',
      phone: `98765432${String(i).padStart(2, '0')}`,
      status
    });

    const completionDateVal = new Date(enrollmentDate);
    completionDateVal.setMonth(completionDateVal.getMonth() + (selectedCourse.durationMonths || 3));

    const student = await Student.create({
      userId: user._id,
      counsellor: assignedCounsellor._id,
      teacher: assignedTeacher._id,
      course: selectedCourse._id,
      batch,
      enrollmentDate,
      fees_total,
      fees_paid,
      family: {
        father: { name: 'Father ' + name, phone: '9988776655' },
        mother: { name: 'Mother ' + name, phone: '9988776644' },
        guardian: { name: 'Guardian ' + name, relation: 'Uncle', phone: '9988776633' }
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

    // Find the batch doc
    const batchDoc = batches.find(b => b.name === batch);

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
      course: selectedCourse._id,
      batch: batchDoc ? batchDoc._id : null,
      totalAmount: fees_total,
      paidAmount: fees_paid,
      discount,
      discountReason: discount > 0 ? 'Scholastic intake grant' : '',
      dueDate: new Date(enrollmentDate.getTime() + 90 * 24 * 60 * 60 * 1000),
      payments,
      createdAt: enrollmentDate
    });
  }

  console.log('📈 Seeding Student Progress records...');
  for (const s of studentList) {
    const batchDoc = batches.find(b => b.name === s.batch);
    if (!batchDoc) continue;

    await Progress.create({
      student: s._id,
      course: s.course,
      batch: batchDoc._id,
      teacher: s.teacher,
      testResults: [
        { testName: 'Mid-term Assessment', score: 80 + Math.floor(Math.random() * 18), totalMarks: 100, date: s.enrollmentDate.toISOString().split('T')[0], remarks: 'Excellent performance.' },
        { testName: 'Final Theory Exam', score: 75 + Math.floor(Math.random() * 22), totalMarks: 100, date: new Date(s.enrollmentDate.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], remarks: 'Well prepared.' }
      ],
      teacherRemark: 'Good progress overall, highly participative in classroom tasks.'
    });
  }

  console.log('📈 Seeding CRM Leads and separate LeadActivity timelines...');
  const leadNames = [
    'Vikram Malhotra', 'Siddarth Roy', 'Pooja Sharma', 'Abhay Deol', 'Nisha Rawat',
    'Rajesh Koothrapali', 'Howard Wolowitz', 'Leonard Hofstadter', 'Penny Hofstadter', 'Sheldon Cooper',
    'Monica Geller', 'Chandler Bing', 'Joey Tribbiani', 'Rachel Green', 'Phoebe Buffay'
  ];
  const leadSources = ['Walk-in', 'Website', 'Referral', 'Social Media', 'Advertisement', 'WhatsApp', 'Other'];
  const leadStatuses = ['new', 'contacted', 'mentorship_scheduled', 'admission_completed', 'lost'];

  for (let i = 0; i < leadNames.length; i++) {
    const status = leadStatuses[i % leadStatuses.length];
    const assignedCounsellor = counsellors[i % counsellors.length];
    const createdDate = new Date(Date.now() - (30 * i * 24 * 60 * 60 * 1000));
    const courseName = courses[i % courses.length];
    const selectedCourse = courseName === 'Video Editing' ? courseVE : (courseName === 'Digital Marketing' ? courseDM : courseBoth);
    
    const lead = await Lead.create({
      name: leadNames[i],
      phone: `90909090${String(i).padStart(2, '0')}`,
      email: `${leadNames[i].toLowerCase().replace(/ /g, '.')}@gmail.com`,
      interestedCourse: selectedCourse._id,
      source: leadSources[i % leadSources.length],
      status: status,
      assignedTo: assignedCounsellor._id,
      nextFollowUpAt: status !== 'admission_completed' && status !== 'lost' ? new Date(Date.now() + ((i - 2) * 24 * 60 * 60 * 1000)) : null,
      convertedStudent: status === 'admission_completed' ? studentList[i % studentList.length]._id : null,
      convertedAt: status === 'admission_completed' ? new Date(createdDate.getTime() + 72 * 3600000) : null,
      createdAt: createdDate
    });

    // Seed activities in LeadActivity
    await LeadActivity.create({
      lead: lead._id,
      type: 'lead_created',
      title: 'Lead Registered',
      note: `Prospect joined via ${lead.source}.`,
      counsellor: assignedCounsellor._id,
      doneBy: assignedCounsellor._id,
      createdAt: createdDate
    });

    if (status !== 'new') {
      await LeadActivity.create({
        lead: lead._id,
        type: 'status_changed',
        title: 'Status: Contacted',
        note: `Contacted lead. Discussed course parameters.`,
        counsellor: assignedCounsellor._id,
        doneBy: assignedCounsellor._id,
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
        note: `Scheduled guidance demo on ${courseName}.`,
        counsellor: assignedCounsellor._id,
        doneBy: assignedCounsellor._id,
        createdAt: new Date(createdDate.getTime() + 48 * 3600000)
      });
    }

    if (status === 'admission_completed') {
      await LeadActivity.create({
        lead: lead._id,
        type: 'converted',
        title: 'Admission Finalized',
        note: `Registered student, set up payment milestones.`,
        counsellor: assignedCounsellor._id,
        doneBy: assignedCounsellor._id,
        createdAt: new Date(createdDate.getTime() + 72 * 3600000)
      });
    } else if (status === 'lost') {
      await LeadActivity.create({
        lead: lead._id,
        type: 'lost',
        title: 'Intake Deferred',
        note: `Student opted for another track. Marked lost.`,
        counsellor: assignedCounsellor._id,
        doneBy: assignedCounsellor._id,
        createdAt: new Date(createdDate.getTime() + 72 * 3600000)
      });
    }
  }

  console.log('📚 Seeding Assignments & Submissions...');
  for (const b of batches) {
    let teacher;
    let subject;
    const courseDoc = b.course.toString() === courseVE._id.toString() ? courseVE : courseDM;

    if (b.name.startsWith('VE-')) {
      const veTeachers = [teachers[0], teachers[2], teachers[5]];
      teacher = veTeachers[batches.indexOf(b) % veTeachers.length];
      subject = 'Video Editing';
    } else {
      const dmTeachers = [teachers[1], teachers[3], teachers[4]];
      teacher = dmTeachers[batches.indexOf(b) % dmTeachers.length];
      subject = 'Digital Marketing';
    }

    for (let j = 1; j <= 8; j++) {
      let dueDate;
      if (j <= 6) {
        dueDate = new Date(Date.now() - (j * 45 * 24 * 60 * 60 * 1000));
      } else {
        dueDate = new Date(Date.now() + ((j - 6) * 10 * 24 * 60 * 60 * 1000));
      }

      const creationDate = new Date(dueDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      const submissions = [];

      const batchStudents = studentList.filter(s => s.batch === b.name && s.enrollmentDate <= creationDate);

      batchStudents.forEach((s, idx) => {
        if (dueDate < new Date()) {
          if (idx % 7 === 0) {
            return;
          }

          const isLate = idx % 11 === 0;
          const isGraded = idx % 3 !== 0;

          submissions.push({
            student: s._id,
            fileUrl: `/uploads/submission_${s._id}_${j}.zip`,
            fileName: `homework_project_${j}.zip`,
            note: isLate ? 'Sorry for the late submission teacher.' : 'Completed all requirements.',
            submittedAt: isLate ? new Date(dueDate.getTime() + 12 * 3600000) : new Date(creationDate.getTime() + 4 * 24 * 60 * 60 * 1000),
            marks: isGraded ? (70 + (idx % 25)) : null,
            feedback: isGraded ? 'Great effort, structures look clean.' : '',
            status: isGraded ? 'graded' : (isLate ? 'late' : 'submitted')
          });
        } else {
          if (idx % 3 === 0) {
            submissions.push({
              student: s._id,
              fileUrl: `/uploads/submission_${s._id}_${j}.zip`,
              fileName: `homework_project_${j}.zip`,
              note: 'Submitting early.',
              submittedAt: new Date(creationDate.getTime() + 2 * 24 * 60 * 60 * 1000),
              marks: null,
              feedback: '',
              status: 'submitted'
            });
          }
        }
      });

      await Assignment.create({
        title: `${subject} - Practice Project ${j}`,
        description: `This is the practice project task ${j} designed to test batch knowledge in ${subject}.`,
        course: b.course,
        batch: b._id,
        teacher: teacher._id,
        dueDate,
        totalMarks: 100,
        submissions,
        isActive: true,
        createdAt: creationDate
      });
    }
  }

  console.log('🗓️ Seeding 3 Years of Class Schedules & Attendance...');
  const currentDate = new Date();
  const daysToSeed = [];
  let runner = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
  
  while (runner < currentDate) {
    const dayOfWeek = runner.getDay();
    const dateStr = runner.toISOString().split('T')[0];
    
    if (dayOfWeek !== 0 && !holidayDates.has(dateStr)) {
      daysToSeed.push({
        dateStr,
        dayOfWeek,
        rawDate: new Date(runner)
      });
    }
    runner.setDate(runner.getDate() + 1);
  }

  const sampledClassDays = daysToSeed.filter((_, idx) => idx % 4 === 0);

  for (const day of sampledClassDays) {
    for (const b of batches) {
      let teacher;
      let subject;
      if (b.name.startsWith('VE-')) {
        const veTeachers = [teachers[0], teachers[2], teachers[5]];
        teacher = veTeachers[batches.indexOf(b) % veTeachers.length];
        subject = 'Video Editing';
      } else {
        const dmTeachers = [teachers[1], teachers[3], teachers[4]];
        teacher = dmTeachers[batches.indexOf(b) % dmTeachers.length];
        subject = 'Digital Marketing';
      }

      const onLeave = leaveRequests.some(l => {
        if (l.user.toString() !== teacher._id.toString()) return false;
        return day.dateStr >= l.startDate && day.dateStr <= l.endDate;
      });

      if (onLeave) continue;

      let selectedClassroom = b.name.startsWith('VE-') ? classrooms[0] : classrooms[1];

      let startTime = '09:00 AM';
      let endTime = '10:30 AM';
      if (b.name.includes('-11AM-')) {
        startTime = '11:00 AM';
        endTime = '12:30 PM';
      } else if (b.name.includes('-03PM-')) {
        startTime = '03:00 PM';
        endTime = '04:30 PM';
      } else if (b.name.includes('-05PM-')) {
        startTime = '05:00 PM';
        endTime = '06:30 PM';
      }

      await Schedule.create({
        subject,
        course: b.course,
        batch: b._id,
        teacher: teacher._id,
        classroom: selectedClassroom._id,
        date: day.dateStr,
        startTime,
        endTime,
        status: day.rawDate < currentDate ? 'completed' : 'scheduled'
      });

      const batchStudents = studentList.filter(s => s.batch === b.name && s.enrollmentDate <= day.rawDate);
      
      for (const s of batchStudents) {
        const isCompleteAtDate = s.statusHistory.some(sh => sh.status === 'complete' && day.rawDate > sh.date);
        const isDropAtDate = s.statusHistory.some(sh => sh.status === 'drop' && day.rawDate > sh.date);
        if (isCompleteAtDate || isDropAtDate) {
          continue;
        }

        const rand = Math.random();
        const status = rand > 0.88 ? 'absent' : (rand > 0.78 ? 'late' : 'present');

        await Attendance.create({
          student: s._id,
          teacher: teacher._id,
          course: b.course,
          batch: b._id,
          date: day.dateStr,
          status,
          note: status !== 'present' ? 'Automated roll mark' : ''
        });
      }

      if (day.rawDate < currentDate) {
        const courseDoc = b.course.toString() === courseVE._id.toString() ? courseVE : courseDM;
        const firstModule = courseDoc.modules[0];
        const coveredTopics = firstModule ? [{
          moduleId: firstModule._id,
          topicId: firstModule.topics[0]._id,
          title: firstModule.topics[0].title
        }] : [];

        await DailyUpdate.create({
          title: `Session: ${firstModule ? firstModule.title : 'General Overview'}`,
          course: b.course,
          batch: b._id,
          content: `Taught core topics in ${subject}.`,
          homework: `Practice assignments for lesson date: ${day.dateStr}`,
          teacher: teacher._id,
          date: day.dateStr,
          coveredTopics
        });
      }
    }
  }

  console.log('📚 Seeding Curriculums for all Batches...');
  for (const b of batches) {
    const primaryTeacher = b.teachers[0];
    const courseDoc = b.course.toString() === courseVE._id.toString() ? courseVE : courseDM;
    
    // Mark first module topics as completed
    const completedTopics = [];
    const firstModule = courseDoc.modules[0];
    if (firstModule && primaryTeacher) {
      firstModule.topics.forEach(t => {
        completedTopics.push({
          moduleId: firstModule._id,
          topicId: t._id,
          completedBy: primaryTeacher,
          completedDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          note: 'Covered in detail with exercises.'
        });
      });
    }

    await Curriculum.create({
      course: b.course,
      batch: b.name,
      teacher: primaryTeacher,
      completedTopics,
      description: `Curriculum tracking for batch ${b.name}`
    });
  }

  console.log('✉️ Seeding Messages (Inbox/Outbox)...');
  // Admin to teacher
  await Message.create({
    sender: admin._id,
    recipient: teachers[0]._id,
    content: 'Hi Rohan, please upload the curriculum updates for Video Editing by this weekend.',
    read: true,
    readAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  });

  // Student to Teacher
  if (studentList.length > 0) {
    const studentUser = studentList[0].userId;
    await Message.create({
      sender: studentUser,
      recipient: teachers[0]._id,
      content: 'Hello Sir, I have submitted my practice project 1. Please review it.',
      read: false
    });

    // Counsellor to student
    await Message.create({
      sender: counsellors[0]._id,
      recipient: studentUser,
      content: 'Hi, welcome to Vande ERP. Let me know if you face any issues with your portal access.',
      read: true,
      readAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
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
    const targetAmt = 80000 + Math.floor(Math.random() * 60000);
    await RevenueTarget.create({
      month: m,
      amount: targetAmt
    });

    await Expense.create({
      month: m,
      category: 'rent',
      amount: 30000,
      description: 'Monthly classroom & office space rent',
      date: new Date(`${m}-01`)
    });

    const elecAmount = 4000 + Math.floor(Math.random() * 3500);
    await Expense.create({
      month: m,
      category: 'electricity',
      amount: elecAmount,
      description: 'Electricity utility bill',
      date: new Date(`${m}-10`)
    });

    await Expense.create({
      month: m,
      category: 'staff',
      amount: 45000,
      description: 'Salaries for teaching assistant and admin support',
      date: new Date(`${m}-05`)
    });

    const miscAmount = 1000 + Math.floor(Math.random() * 4000);
    await Expense.create({
      month: m,
      category: 'miscellaneous',
      amount: miscAmount,
      description: 'Internet, printing, tea/coffee, office supplies',
      date: new Date(`${m}-15`)
    });
  }

  console.log('✅ 3-Year historical database seeded successfully!');
  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch(err => {
    console.error('❌ Seeder script failed:', err);
    process.exit(1);
  });
}

module.exports = seed;
