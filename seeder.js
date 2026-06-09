require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Lead = require('./models/Lead');
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
  await Lead.deleteMany({});
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
      qualification: 'M.Sc. in Film Editing & VFX'
    },
    {
      name: 'Priya Patel',
      email: 'priya.teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888802',
      subject: 'Digital Marketing',
      qualification: 'MBA in Marketing, 8+ Yrs Corporate Experience'
    },
    {
      name: 'Amit Verma',
      email: 'amit.teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888803',
      subject: 'Video Editing',
      qualification: 'BFA in Cinema Studies'
    },
    {
      name: 'Sneha Kapoor',
      email: 'sneha.teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888804',
      subject: 'Digital Marketing',
      qualification: 'MA in Journalism & Communication'
    },
    {
      name: 'Gaurav Sen',
      email: 'gaurav.teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888805',
      subject: 'Digital Marketing',
      qualification: 'Certified Google Ads Specialist'
    },
    {
      name: 'Default Teacher',
      email: 'teacher@gmail.com',
      password: 'password123',
      role: 'teacher',
      phone: '8888888888',
      subject: 'Video Editing',
      qualification: 'Lead Faculty'
    }
  ];
  
  const teachers = [];
  for (const t of teacherData) {
    teachers.push(await User.create(t));
  }

  console.log('🤝 Seeding 3 Counsellors...');
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
    counsellors.push(await User.create(c));
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
  // Seed some approved and rejected leaves
  const leaveRequests = [
    {
      teacher: teachers[0]._id,
      startDate: "2024-04-10",
      endDate: "2024-04-12",
      reason: "Family wedding event in hometown",
      status: "approved"
    },
    {
      teacher: teachers[1]._id,
      startDate: "2025-02-15",
      endDate: "2025-02-18",
      reason: "Medical leave due to viral fever",
      status: "approved"
    },
    {
      teacher: teachers[2]._id,
      startDate: "2025-06-20",
      endDate: "2025-06-22",
      reason: "Urgent personal work",
      status: "rejected"
    },
    {
      teacher: teachers[3]._id,
      startDate: "2026-03-01",
      endDate: "2026-03-03",
      reason: "Dental operation treatment recovery",
      status: "approved"
    }
  ];

  for (const leave of leaveRequests) {
    await LeaveRequest.create(leave);
  }

  console.log('👨‍🎓 Seeding Students Portfolio with 3-Year Registration timelines...');
  const studentNames = [
    'Siddharth Patel', 'Aarav Mehta', 'Ananya Roy', 'Vihaan Sharma', 'Diya Nair',
    'Ishaan Gupta', 'Kiara Sen', 'Kabir Das', 'Meera Rao', 'Aditya Mishra',
    'Riya Kapoor', 'Arjun Saxena', 'Sanya Gill', 'Dev Shah', 'Tanya Joshi',
    'Rohan Bajaj', 'Isha Singhal', 'Rahul Bose', 'Sneha Reddy', 'Vivek Dubey',
    'Neha Choudhury', 'Yash Singhania', 'Aditi Kulkarni', 'Manish Pandey', 'Prisha Desai',
    'Abhishek Kumar', 'Shreya Ghoshal', 'Nikhil Kamath', 'Kriti Sanon', 'Kunal Bahl'
  ];

  const courses = ['Video Editing', 'Digital Marketing', 'Both'];
  const batches = {
    'Video Editing': ['VE-09AM-A1', 'VE-11AM-A1', 'VE-03PM-A1', 'VE-05PM-A1'],
    'Digital Marketing': ['DM-09AM-A1', 'DM-11AM-A1', 'DM-03PM-A1', 'DM-05PM-A1'],
    'Both': ['VE-09AM-A1', 'DM-03PM-A1']
  };

  const studentList = [];

  for (let i = 0; i < studentNames.length; i++) {
    const name = studentNames[i];
    const email = i === 0 ? 'student@gmail.com' : `${name.toLowerCase().replace(/ /g, '.')}@gmail.com`;
    const course = i === 0 ? 'Video Editing' : courses[i % courses.length];
    const possibleBatches = batches[course];
    const batch = possibleBatches[i % possibleBatches.length];

    // Distribute registration dates over the past 3 years:
    // Students 0-9: enrolled in 2023-2024 (completed)
    // Students 10-19: enrolled in 2024-2025 (completed/active)
    // Students 20-29: enrolled recently in 2025-2026 (active)
    let enrollmentDate;
    let status = 'active';
    let feedback = { submitted: false };
    
    if (i < 10) {
      enrollmentDate = new Date(2023, 2 + (i % 8), 10 + i);
      status = 'complete';
      feedback = {
        submitted: true,
        teacherRating: 5,
        contentRating: 4,
        facilitiesRating: 5,
        comments: 'Excellent program! Really boosted my professional skillsets.',
        submittedAt: new Date(2023, 8, 20)
      };
    } else if (i < 20) {
      enrollmentDate = new Date(2024, 4 + (i % 6), 5 + i);
      status = (i % 2 === 0) ? 'complete' : 'active';
      if (status === 'complete') {
        feedback = {
          submitted: true,
          teacherRating: 4,
          contentRating: 5,
          facilitiesRating: 4,
          comments: 'Loved the hands-on project reviews.',
          submittedAt: new Date(2024, 11, 15)
        };
      }
    } else {
      enrollmentDate = new Date(Date.now() - (i * 3 * 24 * 60 * 60 * 1000)); // recently enrolled
      status = (i === 24) ? 'drop' : 'active';
    }

    const fees_total = course === 'Both' ? 45000 : course === 'Video Editing' ? 25000 : 20000;
    const discount = i % 5 === 0 ? 3000 : 0;
    const netFees = fees_total - discount;
    
    // Payments calculation
    let fees_paid = 0;
    if (status === 'complete') {
      fees_paid = netFees; // fully paid
    } else if (status === 'active') {
      fees_paid = Math.floor(netFees / (1.5 + (i % 3)));
    }

    // Assign Faculty & Counsellors based on batch code prefix
    let assignedTeacher;
    if (batch.startsWith('VE-')) {
      const veTeachers = [teachers[0], teachers[2], teachers[5]];
      assignedTeacher = veTeachers[i % veTeachers.length];
    } else {
      const dmTeachers = [teachers[1], teachers[3], teachers[4]];
      assignedTeacher = dmTeachers[i % dmTeachers.length];
    }
    const assignedCounsellor = counsellors[i % counsellors.length];

    const student = await User.create({
      name,
      email,
      password: 'password123',
      role: 'student',
      phone: `98765432${String(i).padStart(2, '0')}`,
      course,
      batch,
      enrollmentDate,
      fees_total,
      fees_paid,
      status,
      feedback,
      teacher: assignedTeacher._id,
      counsellor: assignedCounsellor._id,
      idVerified: i % 3 === 0,
      idProof: i % 3 === 0 ? `/files/dummy_id_${i}.jpg` : null,
      statusHistory: [
        { status: 'active', changedBy: admin._id, date: enrollmentDate, reason: 'Initial intake' },
        ...(status === 'complete' ? [{ status: 'complete', changedBy: admin._id, date: new Date(enrollmentDate.getTime() + 180 * 24 * 60 * 60 * 1000), reason: 'Completed requirements' }] : []),
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
      course,
      totalAmount: fees_total,
      paidAmount: fees_paid,
      discount,
      discountReason: discount > 0 ? 'Scholastic intake grant' : '',
      dueDate: new Date(enrollmentDate.getTime() + 90 * 24 * 60 * 60 * 1000),
      payments,
      createdAt: enrollmentDate
    });
  }

  console.log('📈 Seeding CRM Leads with follow-up histories...');
  const leadNames = [
    'Vikram Malhotra', 'Siddarth Roy', 'Pooja Sharma', 'Abhay Deol', 'Nisha Rawat',
    'Rajesh Koothrapali', 'Howard Wolowitz', 'Leonard Hofstadter', 'Penny Hofstadter', 'Sheldon Cooper',
    'Monica Geller', 'Chandler Bing', 'Joey Tribbiani', 'Rachel Green', 'Phoebe Buffay'
  ];
  const leadSources = ['Walk-in', 'Website', 'Referral', 'Social Media', 'Advertisement', 'WhatsApp', 'Other'];
  const leadStatuses = ['new', 'contacted', 'interested', 'converted', 'lost'];

  for (let i = 0; i < leadNames.length; i++) {
    const status = leadStatuses[i % leadStatuses.length];
    const assignedCounsellor = counsellors[i % counsellors.length];
    const createdDate = new Date(Date.now() - (30 * i * 24 * 60 * 60 * 1000));
    
    // Detailed multi-step followups
    const followUpHistory = [
      {
        note: `Initial lead registered via ${leadSources[i % leadSources.length]}.`,
        status: 'new',
        doneBy: assignedCounsellor._id,
        dateAt: new Date(createdDate.getTime() + 1 * 3600000)
      }
    ];

    if (status !== 'new') {
      followUpHistory.push({
        note: `Contacted lead. Explained courses, batch options and fees.`,
        status: 'contacted',
        doneBy: assignedCounsellor._id,
        dateAt: new Date(createdDate.getTime() + 24 * 3600000)
      });
    }

    if (status === 'interested' || status === 'converted') {
      followUpHistory.push({
        note: `Lead showed high interest in ${courses[i % courses.length]} program. Requested demo class.`,
        status: 'interested',
        doneBy: assignedCounsellor._id,
        dateAt: new Date(createdDate.getTime() + 48 * 3600000)
      });
    }

    if (status === 'converted') {
      followUpHistory.push({
        note: `Demo class attended. Student decided to enroll. Ledger created.`,
        status: 'converted',
        doneBy: assignedCounsellor._id,
        dateAt: new Date(createdDate.getTime() + 72 * 3600000)
      });
    } else if (status === 'lost') {
      followUpHistory.push({
        note: `Followed up twice. Student decided to defer training due to other jobs. Marked as lost.`,
        status: 'lost',
        doneBy: assignedCounsellor._id,
        dateAt: new Date(createdDate.getTime() + 72 * 3600000)
      });
    }

    await Lead.create({
      name: leadNames[i],
      phone: `90909090${String(i).padStart(2, '0')}`,
      email: `${leadNames[i].toLowerCase().replace(/ /g, '.')}@gmail.com`,
      course: courses[i % courses.length],
      source: leadSources[i % leadSources.length],
      status: status,
      notes: `Prospective applicant. Source channel: ${leadSources[i % leadSources.length]}`,
      assignedTo: assignedCounsellor._id,
      followUpDate: status !== 'converted' && status !== 'lost' ? new Date(Date.now() + ((i - 2) * 24 * 60 * 60 * 1000)) : null,
      followUpHistory,
      convertedStudent: status === 'converted' ? studentList[i % studentList.length]._id : null,
      createdAt: createdDate
    });
  }

  console.log('📚 Seeding Assignments & Student Homework Submissions...');
  const allBatches = [
    'VE-09AM-A1', 'VE-11AM-A1', 'VE-03PM-A1', 'VE-05PM-A1',
    'DM-09AM-A1', 'DM-11AM-A1', 'DM-03PM-A1', 'DM-05PM-A1'
  ];

  // We will seed 8 assignments per batch spread over the last 3 years
  for (const b of allBatches) {
    let teacher;
    let subject;
    if (b.startsWith('VE-')) {
      const veTeachers = [teachers[0], teachers[2], teachers[5]];
      teacher = veTeachers[allBatches.indexOf(b) % veTeachers.length];
      subject = 'Video Editing';
    } else {
      const dmTeachers = [teachers[1], teachers[3], teachers[4]];
      teacher = dmTeachers[allBatches.indexOf(b) % dmTeachers.length];
      subject = 'Digital Marketing';
    }

    for (let j = 1; j <= 8; j++) {
      // 6 assignments are in the past, 2 are in the future
      let dueDate;
      if (j <= 6) {
        // past assignments
        dueDate = new Date(Date.now() - (j * 45 * 24 * 60 * 60 * 1000));
      } else {
        // future assignments
        dueDate = new Date(Date.now() + ((j - 6) * 10 * 24 * 60 * 60 * 1000));
      }

      const creationDate = new Date(dueDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      const submissions = [];

      // Find students in this batch who enrolled before this assignment creation date
      const batchStudents = studentList.filter(s => s.batch === b && s.enrollmentDate <= creationDate);

      batchStudents.forEach((s, idx) => {
        // Distribute submission states
        if (dueDate < new Date()) {
          // Past assignments
          // Slacker student: student list index is divisible by 7 (leave unsubmitted/overdue!)
          if (idx % 7 === 0) {
            return; // no submission
          }

          const isLate = idx % 11 === 0;
          const isGraded = idx % 3 !== 0;

          submissions.push({
            student: s._id,
            fileUrl: `/files/submission_${s._id}_${j}.zip`,
            fileName: `homework_project_${j}.zip`,
            note: isLate ? 'Sorry for the late submission teacher.' : 'Completed all requirements.',
            submittedAt: isLate ? new Date(dueDate.getTime() + 12 * 3600000) : new Date(creationDate.getTime() + 4 * 24 * 60 * 60 * 1000),
            marks: isGraded ? (70 + (idx % 25)) : null,
            feedback: isGraded ? 'Great effort, code structures look clean.' : '',
            status: isGraded ? 'graded' : (isLate ? 'late' : 'submitted')
          });
        } else {
          // Future assignments
          // Some submit early, some leave blank
          if (idx % 3 === 0) {
            submissions.push({
              student: s._id,
              fileUrl: `/files/submission_${s._id}_${j}.zip`,
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
        subject,
        batch: b,
        teacher: teacher._id,
        dueDate,
        totalMarks: 100,
        submissions,
        isActive: true,
        createdAt: creationDate
      });
    }
  }

  console.log('🗓️ Seeding 3 Years of Class Schedules & Attendance Records...');
  // Loop back day-by-day for the past 3 years to populate realistic historical logs.
  const currentDate = new Date();
  
  // Seed historical class dates (1 class every Monday & Wednesday for each batch over the last 3 years)
  const daysToSeed = [];
  let runner = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000); // 3 years ago
  
  while (runner < currentDate) {
    const dayOfWeek = runner.getDay(); // 0: Sun, 1: Mon, etc.
    const dateStr = runner.toISOString().split('T')[0];
    
    // Exclude Sundays and Holidays
    if (dayOfWeek !== 0 && !holidayDates.has(dateStr)) {
      daysToSeed.push({
        dateStr,
        dayOfWeek,
        rawDate: new Date(runner)
      });
    }
    runner.setDate(runner.getDate() + 1); // next day
  }

  // To prevent running out of database limits, we will sample 1 in 4 days
  const sampledClassDays = daysToSeed.filter((_, idx) => idx % 4 === 0);

  for (const day of sampledClassDays) {
    for (const b of allBatches) {
      let teacher;
      let subject;
      if (b.startsWith('VE-')) {
        const veTeachers = [teachers[0], teachers[2], teachers[5]];
        teacher = veTeachers[allBatches.indexOf(b) % veTeachers.length];
        subject = 'Video Editing';
      } else {
        const dmTeachers = [teachers[1], teachers[3], teachers[4]];
        teacher = dmTeachers[allBatches.indexOf(b) % dmTeachers.length];
        subject = 'Digital Marketing';
      }

      // Verify if teacher was on leave on this date
      const onLeave = leaveRequests.some(l => {
        if (l.teacher.toString() !== teacher._id.toString()) return false;
        return day.dateStr >= l.startDate && day.dateStr <= l.endDate;
      });

      if (onLeave) continue; // Skip seeding schedule and attendance for this teacher

      let selectedClassroom;
      if (b.startsWith('VE-')) {
        selectedClassroom = classrooms[0];
      } else {
        selectedClassroom = classrooms[1];
      }

      // Determine time slot from the batch code (09AM, 11AM, 03PM, 05PM)
      let startTime = '09:00 AM';
      let endTime = '10:30 AM';
      if (b.includes('-11AM-')) {
        startTime = '11:00 AM';
        endTime = '12:30 PM';
      } else if (b.includes('-03PM-')) {
        startTime = '03:00 PM';
        endTime = '04:30 PM';
      } else if (b.includes('-05PM-')) {
        startTime = '05:00 PM';
        endTime = '06:30 PM';
      }

      // Create Schedule
      await Schedule.create({
        subject,
        batch: b,
        teacher: teacher._id,
        classroom: selectedClassroom._id,
        date: day.dateStr,
        startTime,
        endTime,
        status: day.rawDate < currentDate ? 'completed' : 'scheduled'
      });

      // Roster students enrolled in this batch
      const batchStudents = studentList.filter(s => s.batch === b && s.enrollmentDate <= day.rawDate);
      
      for (const s of batchStudents) {
        // Only mark attendance if student is active/complete at that date
        const isCompleteAtDate = s.status === 'complete' && day.rawDate > new Date(s.enrollmentDate.getTime() + 180 * 24 * 60 * 60 * 1000);
        if (isCompleteAtDate || s.status === 'drop' && day.rawDate > new Date(s.enrollmentDate.getTime() + 45 * 24 * 60 * 60 * 1000)) {
          continue; // Student was no longer attending classes
        }

        const rand = Math.random();
        const status = rand > 0.88 ? 'absent' : (rand > 0.78 ? 'late' : 'present');

        await Attendance.create({
          student: s._id,
          teacher: teacher._id,
          subject,
          batch: b,
          date: day.dateStr,
          status,
          note: status !== 'present' ? 'Automated roll mark' : ''
        });
      }

      // Add a Daily Lesson Update for past dates
      if (day.rawDate < currentDate) {
        await DailyUpdate.create({
          subject,
          batch: b,
          homework: `Practice assignments for lesson date: ${day.dateStr}`,
          teacher: teacher._id,
          date: day.dateStr,
          topics: b.includes('Video') ? ['Editing interface', 'Timeline management'] : ['Ad campaigns', 'SEO tools']
        });
      }
    }
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

seed().catch(err => {
  console.error('❌ Seeder script failed:', err);
  process.exit(1);
});

