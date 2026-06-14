require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const Student = require('./models/Student');
const Teacher = require('./models/Teacher');
const Counsellor = require('./models/Counsellor');
const Course = require('./models/Course');
const Batch = require('./models/Batch');
const Classroom = require('./models/Classroom');
const Timetable = require('./models/Timetable');
const Schedule = require('./models/Schedule');
const Attendance = require('./models/Attendance');
const Assignment = require('./models/Assignment');
const Fee = require('./models/Fee');
const Lead = require('./models/Lead');
const Progress = require('./models/Progress');
const Curriculum = require('./models/Curriculum');
const DailyUpdate = require('./models/DailyUpdate');
const Holiday = require('./models/Holiday');
const Counter = require('./models/Counter');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vande-academy';
const PASSWORD = '123456';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const rand   = arr => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function dateStr(d) { return new Date(d).toISOString().slice(0, 10); }

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function makePhone(seed) {
  // deterministic but looks like a real Indian mobile
  const base = 7000000000 + seed * 97;
  return String(base).slice(0, 10);
}

// ─────────────────────────────────────────────
// NAME DATA
// ─────────────────────────────────────────────

const maleFirstNames = [
  'Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan',
  'Kabir','Yash','Dev','Harsh','Nikhil','Rohan','Kunal','Manav','Tanish','Daksh',
  'Dhruv','Rishabh','Pranav','Shubham','Varun','Karan','Ankit','Akash','Rahul','Deepak'
];
const femaleFirstNames = [
  'Anaya','Diya','Myra','Kiara','Anika','Riya','Avni','Sara','Ira','Pari',
  'Priya','Sneha','Pooja','Neha','Simran','Divya','Meera','Kavya','Tanvi','Ishika'
];
const lastNames = [
  'Sharma','Verma','Patel','Singh','Mehta','Jain','Bohra','Rathore','Choudhary','Khan',
  'Gupta','Soni','Joshi','Purohit','Bansal','Agarwal','Vyas','Trivedi','Kapoor','Malhotra',
  'Bishnoi','Gehlot','Bhati','Rajpurohit','Pareek','Swami','Mathur','Saxena','Yadav','Sisodia'
];

const localities = [
  'Sardarpura','Ratanada','Paota','Shastri Nagar','Mandore','Pal Road','Chopasni Housing Board',
  'Residency Road','Sojati Gate','Mahamandir','Jalori Gate','Basni','Bhagat Ki Kothi'
];

const cities = ['Jodhpur','Bikaner','Jaipur','Phalodi','Nagaur','Pali','Barmer','Jaisalmer','Sikar'];

const qualifications = [
  'B.Tech in Computer Science','BCA Graduate','BSc IT','MBA in Marketing',
  'B.Com with Digital Media','Mass Communication Graduate','B.Des in Visual Communication'
];

let _nameIdx = 0;
function makeName(gender = null) {
  const g    = gender || (Math.random() < 0.55 ? 'male' : 'female');
  const first = g === 'male' ? maleFirstNames[_nameIdx % maleFirstNames.length]
                             : femaleFirstNames[_nameIdx % femaleFirstNames.length];
  const last  = lastNames[_nameIdx % lastNames.length];
  _nameIdx++;
  return { name: `${first} ${last}`, gender: g };
}

function makeAddress() {
  return `House No. ${randInt(10, 500)}, ${rand(localities)}, ${rand(cities)}`;
}

// ─────────────────────────────────────────────
// COURSE MODULES
// ─────────────────────────────────────────────

const videoEditingModules = [
  {
    title: 'Video Editing Fundamentals',
    order: 1,
    description: 'Core editing concepts, software basics, and workflow setup.',
    topics: [
      { title: 'Introduction to Video Editing',     order: 1, description: 'Overview of video editing landscape and career scope.' },
      { title: 'Editing Workflow & File Management', order: 2, description: 'Organising footage, proxy files, and project folder structure.' },
      { title: 'Timeline Basics in Premiere Pro',   order: 3, description: 'Understanding sequences, tracks, and the timeline panel.' },
      { title: 'Cutting & Trimming Techniques',     order: 4, description: 'Razor tool, ripple edit, roll edit, and slip trim.' },
      { title: 'Transitions & Motion Effects',      order: 5, description: 'Smooth cut transitions, zoom-ins, and keyframe basics.' }
    ]
  },
  {
    title: 'Audio & Color Correction',
    order: 2,
    description: 'Professional audio cleanup and cinematic color grading.',
    topics: [
      { title: 'Audio Sync & Mixing',            order: 1, description: 'Syncing dual-system audio, EQ, noise reduction.' },
      { title: 'Color Correction in Lumetri',    order: 2, description: 'Basic exposure and white balance correction.' },
      { title: 'Color Grading & LUT Application', order: 3, description: 'Cinematic grading, skin tone management, LUTs.' },
      { title: 'Text, Titles & Lower Thirds',     order: 4, description: 'Essential and Motion Graphics templates.' },
      { title: 'Export Settings & Delivery',      order: 5, description: 'Export presets for YouTube, Instagram, and client delivery.' }
    ]
  },
  {
    title: 'Reels, Shorts & Commercial Editing',
    order: 3,
    description: 'Short-form and commercial content for social media platforms.',
    topics: [
      { title: 'Short-Form Editing for Reels',    order: 1, description: 'Hook-first editing, beat-sync, and retention tricks.' },
      { title: 'Motion Text & Kinetic Typography', order: 2, description: 'Animated text for social-first content.' },
      { title: 'Wedding & Event Highlight Reel',   order: 3, description: 'Storytelling, music sync, and emotional pacing.' },
      { title: 'Client Revision Workflow',         order: 4, description: 'Frame.io reviews, version control, and delivery.' }
    ]
  }
];

const digitalMarketingModules = [
  {
    title: 'Digital Marketing Foundations',
    order: 1,
    description: 'Core marketing principles adapted for the digital world.',
    topics: [
      { title: 'Marketing Funnel & Customer Journey', order: 1, description: 'TOFU/MOFU/BOFU, buyer personas, and intent mapping.' },
      { title: 'Audience & Competitor Research',      order: 2, description: 'SimilarWeb, SpyFu, and manual research techniques.' },
      { title: 'Content Strategy & Planning',         order: 3, description: 'Content calendar, pillar-cluster model, and repurposing.' },
      { title: 'Landing Page Design & Copywriting',   order: 4, description: 'CTA optimisation, headline formulas, A/B testing basics.' },
      { title: 'Email Marketing Basics',              order: 5, description: 'Mailchimp setup, sequences, open-rate optimisation.' }
    ]
  },
  {
    title: 'SEO & Organic Social Media',
    order: 2,
    description: 'Building sustainable organic traffic and social presence.',
    topics: [
      { title: 'On-Page SEO',              order: 1, description: 'Title tags, meta descriptions, schema markup, and internal links.' },
      { title: 'Keyword Research',         order: 2, description: 'Ahrefs, Google Search Console, and long-tail strategy.' },
      { title: 'Technical SEO Basics',     order: 3, description: 'Sitemap, robots.txt, Core Web Vitals.' },
      { title: 'Instagram Growth Strategy', order: 4, description: 'Reels strategy, hashtag research, and profile optimisation.' },
      { title: 'LinkedIn B2B Content',     order: 5, description: 'Thought leadership posts, outreach, and company pages.' }
    ]
  },
  {
    title: 'Paid Ads & Analytics',
    order: 3,
    description: 'Running and measuring paid campaigns across major platforms.',
    topics: [
      { title: 'Meta Ads Manager – Structure & Setup', order: 1, description: 'Campaign/Ad Set/Ad hierarchy, objectives, and pixel setup.' },
      { title: 'Meta Ads – Targeting & Creatives',     order: 2, description: 'Custom audiences, LAL audiences, and creative best practices.' },
      { title: 'Google Ads – Search & Display',        order: 3, description: 'Keyword match types, Quality Score, and bidding strategies.' },
      { title: 'GA4 & Conversion Tracking',            order: 4, description: 'Events, goals, funnels, and attribution models in GA4.' },
      { title: 'Reporting & Client Communication',     order: 5, description: 'Looker Studio dashboards, KPI reporting, and client decks.' }
    ]
  }
];

// ─────────────────────────────────────────────
// ATTENDANCE LOGIC
// ─────────────────────────────────────────────

// Each student gets a personal target attendance % (40–100)
function attendanceStatus(targetPct) {
  const roll = Math.random() * 100;
  if (roll <= targetPct) {
    return Math.random() < 0.07 ? 'late' : 'present';
  }
  return 'absent';
}

// ─────────────────────────────────────────────
// DB CLEAR
// ─────────────────────────────────────────────

async function dropStaleIndexes() {
  const staleIndexes = [
    { collection: 'teachers',    index: 'userId_1' },
    { collection: 'students',    index: 'userId_1' },
    { collection: 'counsellors', index: 'userId_1' },
  ];
  for (const { collection, index } of staleIndexes) {
    try {
      await mongoose.connection.collection(collection).dropIndex(index);
      console.log(`  dropped stale index ${index} on ${collection}`);
    } catch (_) {
      // index didn't exist — fine
    }
  }
}

async function clearDatabase() {
  await dropStaleIndexes();
  await Promise.all([
    User.deleteMany({}),
    Student.deleteMany({}),
    Teacher.deleteMany({}),
    Counsellor.deleteMany({}),
    Course.deleteMany({}),
    Batch.deleteMany({}),
    Classroom.deleteMany({}),
    Timetable.deleteMany({}),
    Schedule.deleteMany({}),
    Attendance.deleteMany({}),
    Assignment.deleteMany({}),
    Fee.deleteMany({}),
    Lead.deleteMany({}),
    Progress.deleteMany({}),
    Curriculum.deleteMany({}),
    DailyUpdate.deleteMany({}),
    Holiday.deleteMany({}),
    Counter.deleteMany({})
  ]);
  console.log('✓ Cleared existing data');
}

// ─────────────────────────────────────────────
// MAIN SEED
// ─────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✓ MongoDB connected');

  await clearDatabase();

  // ── ADMIN ──────────────────────────────────
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@vandeacademy.com',
    password: PASSWORD,
    role: 'admin',
    phone: '9999999999',
    city: 'Jodhpur',
    status: 'active'
  });

  // ── COURSES ────────────────────────────────
  const videoCourse = await Course.create({
    name: 'Video Editing',
    code: 'VE',
    description: 'A comprehensive 2-month practical course covering Premiere Pro editing, color grading, audio mixing, and short-form content creation for social media and client delivery.',
    durationMonths: 2,
    fees: 30000,
    modules: videoEditingModules
  });

  const dmCourse = await Course.create({
    name: 'Digital Marketing',
    code: 'DM',
    description: 'A 2-month hands-on program covering SEO, social media marketing, paid ads (Meta & Google), GA4 analytics, and client reporting — designed for results-driven digital careers.',
    durationMonths: 2,
    fees: 35000,
    modules: digitalMarketingModules
  });

  // ── CLASSROOMS ─────────────────────────────
  // Classroom A → Slot 1 (10:30–12:30 VE) and Slot 3 (16:30–18:30 DM)
  // Classroom B → Slot 2 (14:00–16:00 DM) and Slot 4 (19:00–21:00 VE)
  const classrooms = await Classroom.insertMany([
    { name: 'Classroom A', capacity: 40, location: 'Ground Floor, Main Building', isActive: true },
    { name: 'Classroom B', capacity: 40, location: 'First Floor, Main Building', isActive: true }
  ]);
  const [clsA, clsB] = classrooms;

  // ── TEACHERS (4) ────────────────────────────
  // 2 VE teachers + 2 DM teachers
  const teacherData = [
    {
      name: 'Rohan Sharma',
      email: 'rohan.sharma@vandeacademy.com',
      phone: makePhone(1001),
      qualification: 'B.Tech in Computer Science – 5 yrs Premiere Pro & After Effects experience',
      experienceYears: 5,
      salary: 45000,
      courses: [videoCourse._id],
      gender: 'male'
    },
    {
      name: 'Amit Rathore',
      email: 'amit.rathore@vandeacademy.com',
      phone: makePhone(1002),
      qualification: 'Mass Communication Graduate – 4 yrs in Film & Commercial Editing',
      experienceYears: 4,
      salary: 40000,
      courses: [videoCourse._id],
      gender: 'male'
    },
    {
      name: 'Priya Mehta',
      email: 'priya.mehta@vandeacademy.com',
      phone: makePhone(1003),
      qualification: 'MBA in Marketing – 6 yrs Digital Marketing & Performance Ads',
      experienceYears: 6,
      salary: 50000,
      courses: [dmCourse._id],
      gender: 'female'
    },
    {
      name: 'Sneha Kapoor',
      email: 'sneha.kapoor@vandeacademy.com',
      phone: makePhone(1004),
      qualification: 'BCA Graduate – 3 yrs SEO, Social Media & Google Ads specialist',
      experienceYears: 3,
      salary: 38000,
      courses: [dmCourse._id],
      gender: 'female'
    }
  ];

  const teachers = [];
  for (const td of teacherData) {
    const user = await User.create({
      name: td.name,
      email: td.email,
      password: PASSWORD,
      role: 'teacher',
      phone: td.phone,
      city: 'Jodhpur',
      address: makeAddress(),
      status: 'active'
    });
    const teacher = await Teacher.create({
      user: user._id,
      courses: td.courses,
      qualification: td.qualification,
      experienceYears: td.experienceYears,
      salary: td.salary,
      joiningDate: addDays(new Date(), -randInt(90, 300)),
      status: 'Active'
    });
    teachers.push(teacher);
  }
  // teachers[0] = Rohan  → VE Slot 1 (morning)
  // teachers[1] = Amit   → VE Slot 4 (night)
  // teachers[2] = Priya  → DM Slot 2 (afternoon)
  // teachers[3] = Sneha  → DM Slot 3 (evening)
  console.log('✓ Teachers created');

  // ── COUNSELLORS (6) ─────────────────────────
  const counsellorNames = [
    { name: 'Kavya Joshi',   email: 'kavya.joshi@vandeacademy.com',   phone: makePhone(2001) },
    { name: 'Deepak Verma',  email: 'deepak.verma@vandeacademy.com',  phone: makePhone(2002) },
    { name: 'Ankita Singh',  email: 'ankita.singh@vandeacademy.com',  phone: makePhone(2003) },
    { name: 'Rahul Gupta',   email: 'rahul.gupta@vandeacademy.com',   phone: makePhone(2004) },
    { name: 'Pooja Trivedi', email: 'pooja.trivedi@vandeacademy.com', phone: makePhone(2005) },
    { name: 'Varun Bansal',  email: 'varun.bansal@vandeacademy.com',  phone: makePhone(2006) }
  ];

  const counsellors = [];
  for (const cd of counsellorNames) {
    const user = await User.create({
      name: cd.name,
      email: cd.email,
      password: PASSWORD,
      role: 'counsellor',
      phone: cd.phone,
      city: 'Jodhpur',
      status: 'active'
    });
    const counsellor = await Counsellor.create({ user: user._id });
    counsellors.push(counsellor);
  }
  console.log('✓ Counsellors created');

  // ── DATES ──────────────────────────────────
  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = addDays(today, -34);   // 34 days ago
  const endDate   = addDays(startDate, 59); // 2-month course

  // ── BATCHES ────────────────────────────────
  // Slot 1: 10:30–12:30 → VE Morning  → Classroom A → teacher[0] Rohan
  // Slot 2: 14:00–16:00 → DM Afternoon → Classroom B → teacher[2] Priya
  // Slot 3: 16:30–18:30 → DM Evening   → Classroom A → teacher[3] Sneha
  // Slot 4: 19:00–21:00 → VE Night     → Classroom B → teacher[1] Amit

  const batches = await Batch.insertMany([
    {
      name: 'VE Morning Batch',
      course: videoCourse._id,
      capacity: 40,
      teachers: [teachers[0]._id],
      startDate,
      endDate
    },
    {
      name: 'DM Afternoon Batch',
      course: dmCourse._id,
      capacity: 40,
      teachers: [teachers[2]._id],
      startDate,
      endDate
    },
    {
      name: 'DM Evening Batch',
      course: dmCourse._id,
      capacity: 40,
      teachers: [teachers[3]._id],
      startDate,
      endDate
    },
    {
      name: 'VE Night Batch',
      course: videoCourse._id,
      capacity: 40,
      teachers: [teachers[1]._id],
      startDate,
      endDate
    }
  ]);
  const [veMorning, dmAfternoon, dmEvening, veNight] = batches;
  console.log('✓ Batches created');

  // ── TIMETABLES ─────────────────────────────
  // Each batch runs Mon/Wed/Fri (3 days/week)
  // Progress through modules topics across 8 weeks
  function buildSlots(batchCourse, teacher, classroom, startTime, endTime, days) {
    const slots = [];
    let modIdx = 0, topIdx = 0;
    for (const day of days) {
      const mod   = batchCourse.modules[modIdx];
      const topic = mod.topics[topIdx];
      slots.push({
        dayOfWeek: day,
        teacher: teacher._id,
        classroom: classroom._id,
        startTime,
        endTime,
        moduleId: mod._id,
        topicId: topic._id
      });
      topIdx++;
      if (topIdx >= mod.topics.length) { topIdx = 0; modIdx = (modIdx + 1) % batchCourse.modules.length; }
    }
    return slots;
  }

  const mwfDays  = ['Monday', 'Wednesday', 'Friday'];
  const ttsDays  = ['Tuesday', 'Thursday', 'Saturday'];

  await Timetable.insertMany([
    {
      course: videoCourse._id,
      batch: veMorning._id,
      startDate,
      endDate,
      slots: buildSlots(videoCourse, teachers[0], clsA, '10:30', '12:30', mwfDays)
    },
    {
      course: dmCourse._id,
      batch: dmAfternoon._id,
      startDate,
      endDate,
      slots: buildSlots(dmCourse, teachers[2], clsB, '14:00', '16:00', mwfDays)
    },
    {
      course: dmCourse._id,
      batch: dmEvening._id,
      startDate,
      endDate,
      slots: buildSlots(dmCourse, teachers[3], clsA, '16:30', '18:30', ttsDays)
    },
    {
      course: videoCourse._id,
      batch: veNight._id,
      startDate,
      endDate,
      slots: buildSlots(videoCourse, teachers[1], clsB, '19:00', '21:00', ttsDays)
    }
  ]);
  console.log('✓ Timetables created');

  // ── STUDENTS (70 total) ─────────────────────
  // DM: 60% = 42 students → DM Afternoon 40%, DM Evening 60%
  //   DM Afternoon = 42 * 0.40 = 17 students
  //   DM Evening   = 42 * 0.60 = 25 students
  // VE: 40% = 28 students → VE Morning 60%, VE Night 40%
  //   VE Morning = 28 * 0.60 = 17 students
  //   VE Night   = 28 * 0.40 = 11 students

  const batchPlan = [
    { batch: veMorning,   course: videoCourse, teacher: teachers[0], count: 17 },
    { batch: dmAfternoon, course: dmCourse,    teacher: teachers[2], count: 17 },
    { batch: dmEvening,   course: dmCourse,    teacher: teachers[3], count: 25 },
    { batch: veNight,     course: videoCourse, teacher: teachers[1], count: 11 }
  ];

  const admissionSources = ['Instagram','Facebook','Referral','Walk-in','WhatsApp','Advertisement','Manual','Other'];
  const remarkTemplates = [
    'Student showed strong interest during the demo session. Enrolled after brief negotiation on fees.',
    'Referred by a current student. Enrolled on the same day without hesitation.',
    'Came via Instagram ad, attended a free demo class, and enrolled the following week.',
    'Walk-in enquiry converted after a 30-minute counselling session.',
    'Student was comparing with another institute. Offered course demo and fee breakdown; converted.',
    'Enrolled after attending the Saturday open house. Very enthusiastic about placements.',
    'Parent accompanied. Both were impressed by the lab infrastructure and practical approach.',
    'Needed one follow-up call after the demo. Enrolled post parent approval.',
    'Switched from a competitor institute. Cited better curriculum and lab access.',
    'Online inquiry converted in 2 follow-up calls by counsellor.'
  ];

  const students = [];
  let phoneIdx  = 3000;

  for (const plan of batchPlan) {
    for (let i = 0; i < plan.count; i++) {
      const { name, gender } = makeName();
      const counsellor       = rand(counsellors);
      const phone            = makePhone(phoneIdx++);
      const studentNum       = students.length + 1;
      const email            = `student${studentNum}@demo.com`;
      const admSource        = rand(admissionSources);
      const feePaid          = randInt(8000, plan.course.fees);
      const discount         = rand([0, 0, 1000, 2000, 3000, 5000]);
      const targetAttendance = randInt(40, 100); // variety 40%–100%

      const dob = new Date(
        randInt(2000, 2005),
        randInt(0, 11),
        randInt(1, 28)
      );

      const user = await User.create({
        name,
        email,
        password: PASSWORD,
        role: 'student',
        phone,
        address: makeAddress(),
        city: rand(cities),
        dob,
        status: 'active'
      });

      const student = await Student.create({
        user: user._id,
        counsellor: counsellor._id,
        teacher: plan.teacher._id,
        course: plan.course._id,
        batch: plan.batch._id,
        enrollmentDate: startDate,
        fees_total: plan.course.fees,
        fees_paid: feePaid,
        family: {
          father: {
            name: `${maleFirstNames[randInt(0, maleFirstNames.length - 1)]} ${rand(lastNames)}`,
            phone: makePhone(phoneIdx++)
          },
          mother: {
            name: `${femaleFirstNames[randInt(0, femaleFirstNames.length - 1)]} ${rand(lastNames)}`,
            phone: makePhone(phoneIdx++)
          }
        },
        remarks: [
          {
            postedBy: admin._id,
            role: 'admin',
            note: `Enrolled via ${admSource}. ${rand(remarkTemplates)}`
          }
        ]
      });

      await Fee.create({
        student: student._id,
        course: plan.course._id,
        batch: plan.batch._id,
        totalAmount: plan.course.fees,
        paidAmount: feePaid,
        discount,
        discountReason: discount > 0 ? rand(['Sibling discount','Early bird offer','Referral bonus','Scholarship']) : '',
        courseDurationMonths: 2,
        payments: [
          {
            amount: Math.round(feePaid * 0.6),
            method: rand(['Cash', 'UPI', 'Bank Transfer']),
            receivedBy: admin._id,
            note: 'Admission down payment',
            paidAt: startDate
          },
          ...(feePaid > Math.round(plan.course.fees * 0.5) ? [{
            amount: feePaid - Math.round(feePaid * 0.6),
            method: rand(['Cash', 'UPI', 'Bank Transfer']),
            receivedBy: admin._id,
            note: 'Second installment',
            paidAt: addDays(startDate, randInt(10, 20))
          }] : [])
        ]
      });

      students.push({
        doc: student,
        plan,
        targetAttendance
      });
    }
  }
  console.log(`✓ ${students.length} students created`);

  // ── SCHEDULES ──────────────────────────────
  // Generate one schedule entry per class session from startDate to today
  const timetableDocs = await Timetable.find({});
  const scheduleInserts = [];

  for (const tt of timetableDocs) {
    let cur = new Date(startDate);
    // Generate schedules up to 7 days in the future
    while (cur <= addDays(today, 7)) {
      const dayName = cur.toLocaleDateString('en-US', { weekday: 'long' });
      const slots   = tt.slots.filter(s => s.dayOfWeek === dayName);
      for (const slot of slots) {
        // Only mark past schedules as completed
        const isPast = cur < today;
        scheduleInserts.push({
          course: tt.course,
          batch: tt.batch,
          teacher: slot.teacher,
          classroom: slot.classroom,
          date: dateStr(cur),
          startTime: slot.startTime,
          endTime: slot.endTime,
          moduleId: slot.moduleId || null,
          topicId: slot.topicId || null,
          status: isPast ? 'completed' : 'scheduled'
        });
      }
      cur = addDays(cur, 1);
    }
  }

  // Manually ensure each batch has a schedule session scheduled for today (to facilitate QA testing on any day of the week)
  for (const tt of timetableDocs) {
    if (tt.slots.length > 0) {
      const slot = tt.slots[0];
      // Check if we already added a schedule for today
      const alreadyHasToday = scheduleInserts.some(s => s.batch.toString() === tt.batch.toString() && s.date === dateStr(today));
      if (!alreadyHasToday) {
        scheduleInserts.push({
          course: tt.course,
          batch: tt.batch,
          teacher: slot.teacher,
          classroom: slot.classroom,
          date: dateStr(today),
          startTime: slot.startTime,
          endTime: slot.endTime,
          moduleId: slot.moduleId || null,
          topicId: slot.topicId || null,
          status: 'scheduled'
        });
      }
    }
  }

  const createdSchedules = await Schedule.insertMany(scheduleInserts);
  console.log(`✓ ${createdSchedules.length} schedule sessions created`);

  // ── ATTENDANCE ─────────────────────────────
  const attendanceRecords = [];
  for (const schedule of createdSchedules) {
    // Skip today and future schedules so they can be marked during testing
    if (schedule.date >= dateStr(today)) continue;

    const batchStudents = students.filter(
      s => String(s.doc.batch) === String(schedule.batch)
    );
    for (const s of batchStudents) {
      attendanceRecords.push({
        student: s.doc._id,
        teacher: schedule.teacher,
        course: schedule.course,
        batch: schedule.batch,
        date: schedule.date,
        status: attendanceStatus(s.targetAttendance),
        note: ''
      });
    }
  }
  await Attendance.insertMany(attendanceRecords);
  console.log(`✓ ${attendanceRecords.length} attendance records created`);

  // ── CURRICULUM & DAILY UPDATES ─────────────
  // Mark realistic topic completion: 34 days into a 60-day course ≈ 57% progress
  for (const plan of batchPlan) {
    const course = plan.course;
    const batch  = plan.batch;
    const teacher = plan.teacher;

    // Collect all topics with progressive completion dates
    const completedTopics = [];
    let dayOffset = 2;

    for (const mod of course.modules) {
      for (const topic of mod.topics) {
        if (dayOffset <= 32) {  // topics covered in ~32 of the 34 days elapsed
          completedTopics.push({
            moduleId: mod._id,
            topicId: topic._id,
            completedBy: admin._id,
            completedDate: dateStr(addDays(startDate, dayOffset)),
            note: rand([
              'Practical demonstration completed with live project.',
              'Students practised on their own files post explanation.',
              'Q&A session held after topic completion.',
              'Short quiz taken at end of class.',
              'Hands-on lab session completed.',
              'Recording shared in batch WhatsApp group for revision.'
            ])
          });
          dayOffset += randInt(2, 4);
        }
      }
    }

    await Curriculum.create({
      course: course._id,
      batch: batch._id,
      teacher: teacher._id,
      completedTopics,
      description: `Active curriculum progress for ${batch.name}. ${completedTopics.length} topics completed so far.`
    });

    // Daily updates for the last 10 class days
    const classSchedules = createdSchedules
      .filter(s => String(s.batch) === String(batch._id))
      .slice(-10);

    for (const sch of classSchedules) {
      const topicsForDay = completedTopics.slice(0, 2);
      await DailyUpdate.create({
        title: `${batch.name} – Class Update`,
        course: course._id,
        batch: batch._id,
        teacher: teacher._id,
        content: rand([
          'Class conducted successfully. Topic explained with live project walkthrough. Students practised on their own files.',
          'Interactive session with Q&A. Practical task assigned and reviewed in class.',
          'Revision of previous topic followed by new concept introduction. Lab session completed.',
          'Guest mentor joined for 20 minutes. Practical demonstration and doubt-clearing done.',
          'Assessment quiz conducted. Results shared with students individually.'
        ]),
        homework: rand([
          'Complete the practical task assigned today and submit on the portal.',
          'Revise the topic covered and watch the reference video shared.',
          'Create a mini-project using today\'s skill and bring it to the next class.',
          'Practice the technique 3 times before the next session.',
          'Watch the case study video shared in the WhatsApp group.'
        ]),
        date: sch.date,
        coveredTopics: topicsForDay.map(ct => ({
          moduleId: ct.moduleId,
          topicId: ct.topicId,
          title: 'Class topic',
          note: 'Covered in regular class session.'
        }))
      });
    }
  }
  console.log('✓ Curriculum & daily updates created');

  // ── ASSIGNMENTS (4 per batch) ───────────────
  const assignmentTitles = {
    VE: [
      { title: 'Basic Timeline Edit',        desc: 'Create a 60-second edited video from raw footage provided. Focus on pacing, cuts, and transitions.' },
      { title: 'Audio Sync & Color Grading', desc: 'Sync dual-system audio and apply a cinematic LUT. Submit Premiere Pro project file and exported MP4.' },
      { title: 'Reels Edit – Brand Promo',   desc: 'Edit a 30-second Instagram Reel for a fictional brand using motion text and beat-sync.' },
      { title: 'Final Client Project',        desc: 'End-to-end edit for a wedding highlight reel. Include colour grade, music sync, and lower-thirds.' }
    ],
    DM: [
      { title: 'Marketing Funnel Audit',          desc: 'Analyse a real brand\'s digital funnel and present a 10-slide deck with improvement recommendations.' },
      { title: 'SEO Keyword Research Report',     desc: 'Perform keyword research for a given niche using Ahrefs/Google. Submit a prioritised keyword list.' },
      { title: 'Meta Ads Campaign Blueprint',     desc: 'Design a full Meta Ads campaign (objective, audience, creatives, budget) for a local business.' },
      { title: 'GA4 Analytics Report',            desc: 'Connect GA4 to a demo site, set up events and conversions, and deliver a 5-page analytics report.' }
    ]
  };

  const feedbackOptions = [
    'Excellent work! Great attention to detail.',
    'Good effort. Need to improve pacing in the middle section.',
    'Well structured. Clean execution.',
    'Creative approach. A few technical errors to fix.',
    'Solid submission. Practical skills clearly improving.',
    'Needs improvement. Revisit the topic and resubmit.',
    'Above average. Client-ready quality.'
  ];

  for (const plan of batchPlan) {
    const course   = plan.course;
    const batch    = plan.batch;
    const teacher  = plan.teacher;
    const key      = course.code; // 'VE' or 'DM'
    const titles   = assignmentTitles[key];
    const batchStudents = students.filter(s => String(s.doc.batch) === String(batch._id));

    for (let a = 0; a < 4; a++) {
      // Spread assignments over 12 days to push the last two assignments into the future
      const dueDate  = addDays(startDate, 8 + a * 12); 
      const isPast   = dueDate <= today;

      await Assignment.create({
        title: titles[a].title,
        description: titles[a].desc,
        course: course._id,
        batch: batch._id,
        teacher: teacher._id,
        dueDate,
        totalMarks: 100,
        submissions: batchStudents.map(s => {
          if (!isPast) return { student: s.doc._id, status: 'pending' };

          // Submission probability varies by assignment number
          const subProb = [0.95, 0.85, 0.75, 0.65][a];
          const submitted = Math.random() < subProb;

          if (!submitted) return { student: s.doc._id, status: 'pending' };

          const graded  = a < 2 || Math.random() < 0.7; // early assignments fully graded
          const marks   = graded ? randInt(45, 98) : null;

          return {
            student: s.doc._id,
            fileUrl: `/uploads/assignments/${batch.name.toLowerCase().replace(/ /g, '-')}/a${a + 1}-${s.doc._id}.pdf`,
            fileName: `assignment-${a + 1}-submission.pdf`,
            note: rand(['Submitted on time.', 'Submitted 1 day late.', 'Resubmission after feedback.']),
            marks,
            feedback: graded ? rand(feedbackOptions) : '',
            status: graded ? 'graded' : 'submitted'
          };
        })
      });
    }
  }
  console.log('✓ Assignments with submissions created');

  // ── PROGRESS (test results per student) ─────
  const testNames = {
    VE: ['Module 1 Practical Quiz', 'Mid-Course Edit Test', 'Color Grading Assessment'],
    DM: ['SEO & Content Quiz', 'Mid-Course Campaign Test', 'Analytics & Ads Assessment']
  };

  for (const plan of batchPlan) {
    const course = plan.course;
    const batch  = plan.batch;
    const teacher = plan.teacher;
    const key    = course.code;
    const batchStudents = students.filter(s => String(s.doc.batch) === String(batch._id));

    for (const s of batchStudents) {
      const attendance = s.targetAttendance;

      // Students with higher attendance tend to score better
      const scoreBonus = Math.round((attendance - 60) / 5);

      await Progress.create({
        student: s.doc._id,
        course: course._id,
        batch: batch._id,
        teacher: teacher._id,
        testResults: testNames[key].slice(0, 2).map((testName, idx) => ({
          testName,
          score: Math.min(100, Math.max(25, randInt(40, 90) + scoreBonus)),
          totalMarks: 100,
          date: dateStr(addDays(startDate, 12 + idx * 10)),
          remarks: rand([
            'Strong conceptual understanding demonstrated.',
            'Practical output was above average.',
            'Needs more practice on advanced topics.',
            'Good improvement from previous test.',
            'Consistent performance maintained.'
          ])
        })),
        teacherRemark: rand([
          'Hardworking student. Steady improvement visible.',
          'Attendance needs to improve for better outcomes.',
          'Very creative and quick to grasp concepts.',
          'Strong practical skills. Theoretical understanding needs more work.',
          'Regular practitioner. Will do well in industry.',
          'Participates actively in class. Good attitude.',
          'Improvement needed in assignment submission discipline.',
          'Outstanding student. On track for full marks.'
        ])
      });
    }
  }
  console.log('✓ Progress & test results created');

  // ── LEADS (30 leads: 20 active, 10 converted/lost) ──
  const leadNames = [
    'Suresh Pareek','Lalita Bohra','Mohan Bishnoi','Geeta Rathore','Vikram Jain',
    'Sunita Sharma','Alok Vyas','Rekha Singh','Manoj Patel','Nisha Gupta',
    'Farhan Khan','Divya Soni','Harish Agarwal','Meena Purohit','Tarun Bansal',
    'Anita Trivedi','Sanjay Kapoor','Ritu Malhotra','Bharat Yadav','Komal Gehlot',
    'Girish Bhati','Swati Rajpurohit','Naresh Mathur','Preeti Saxena','Dinesh Choudhary',
    'Vandana Swami','Praveen Joshi','Sunita Mehta','Rajan Verma','Heena Patel'
  ];

  const leadStatuses   = ['new','contacted','follow_up','mentorship_scheduled','mentorship_attended','joining_interested','admission_completed','lost'];
  const lostReasons    = ['Fees Issue','No Response','Joined Another Institute','Parent Not Interested','Financial Issue','Other'];
  const leadSources    = ['Instagram','Facebook','Referral','Walk-in','WhatsApp','Website','Advertisement','Manual','Other'];
  const callOutcomes   = ['answered','callback','no-answer','busy'];
  const followUpNotes  = [
    'Student showed interest in Digital Marketing. Needs parent approval.',
    'Enquired about batch timings and fees. Will discuss with family.',
    'Visited the academy. Liked the labs. Might enrol next week.',
    'Asked for EMI option. Counsellor explained fee structure.',
    'Comparison with XYZ Institute. Shared USPs and placement records.',
    'Parent on call – satisfied with course content. Awaiting decision.',
    'Demo class attended. Positive feedback. Follow-up in 2 days.',
    'Needs time. Asked to call back on weekend.',
    'Very hot lead. Expected to enrol by end of week.',
    'Cold lead – not responding to calls. Trying WhatsApp.',
    'Referred by student Aarav Sharma. High intent.',
    'Called twice. Will try once more before marking lost.',
    'Interested in both courses. Counsellor to send comparison sheet.',
    'Free demo scheduled for Saturday morning.',
    'Agreed on fees. Paperwork pending.'
  ];

  for (let i = 0; i < 30; i++) {
    const counsellor    = rand(counsellors);
    const intCourse     = Math.random() < 0.62 ? dmCourse : videoCourse;
    const status        = rand(leadStatuses);
    const isLost        = status === 'lost';
    const followUps     = randInt(1, 4);
    const category      = rand(['hot','warm','warm','cold']);

    const followUpHistory = Array.from({ length: followUps }, (_, fi) => ({
      note: rand(followUpNotes),
      status: fi === followUps - 1 ? status : 'contacted',
      channel: rand(['call', 'whatsapp', 'call']),
      callOutcome: rand(callOutcomes),
      callDuration: `${randInt(1, 8)}:${String(randInt(0, 59)).padStart(2, '0')}`,
      callAttemptNumber: fi + 1,
      doneBy: admin._id,
      doneAt: addDays(today, -(followUps - fi) * randInt(1, 3))
    }));

    await Lead.create({
      name: leadNames[i] || `Lead ${makeName().name}`,
      phone: makePhone(9000 + i),
      email: `lead${i + 1}@demo.com`,
      interestedCourse: intCourse._id,
      source: rand(leadSources),
      leadType: Math.random() < 0.35 ? 'automation' : 'manual',
      category,
      status,
      assignedTo: counsellor._id,
      ownershipHistory: [
        {
          counsellor: counsellor._id,
          assignedBy: admin._id,
          note: `Assigned on intake from ${rand(leadSources)} campaign.`
        }
      ],
      followUpHistory,
      nextFollowUpAt: isLost ? null : addDays(today, randInt(1, 5)),
      lastContactedAt: addDays(today, -randInt(0, 5)),
      lostReason: isLost ? rand(lostReasons) : '',
      lostNote: isLost ? rand(['Did not respond to multiple follow-ups.', 'Joined competitor institute.', 'Budget constraint.']) : '',
      mentorship: status === 'mentorship_scheduled' ? {
        scheduledAt: addDays(today, randInt(1, 3)),
        takenBy: admin._id,
        feedback: ''
      } : {},
      createdBy: admin._id
    });
  }
  console.log('✓ 30 leads created');

  // ── HOLIDAYS ────────────────────────────────
  await Holiday.insertMany([
    {
      name: 'Independence Day',
      date: '2025-08-15',
      type: 'public',
      note: 'National holiday. No classes.'
    },
    {
      name: 'Diwali',
      date: '2025-10-20',
      type: 'public',
      note: 'Diwali holiday. Academy closed.'
    },
    {
      name: 'Academy Foundation Day',
      date: dateStr(addDays(today, 7)),
      type: 'academy',
      note: 'Academy Anniversary. Special event planned. No regular classes.'
    },
    {
      name: 'Eid al-Adha',
      date: '2025-06-07',
      type: 'public',
      note: 'Public holiday.'
    }
  ]);
  console.log('✓ Holidays created');

  // ── SUMMARY ────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  SEED COMPLETED SUCCESSFULLY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Admin:            admin@vandeacademy.com / ${PASSWORD}`);
  console.log(`Teachers (4):     rohan.sharma@..., amit.rathore@..., priya.mehta@..., sneha.kapoor@vandeacademy.com`);
  console.log(`Counsellors (6):  kavya.joshi@... to varun.bansal@vandeacademy.com`);
  console.log(`Students (70):    student1@demo.com to student70@demo.com / ${PASSWORD}`);
  console.log('\nBatch Breakdown:');
  console.log('  Slot 1 – VE Morning   10:30–12:30  Classroom A  Mon/Wed/Fri  →  17 students');
  console.log('  Slot 2 – DM Afternoon 14:00–16:00  Classroom B  Mon/Wed/Fri  →  17 students');
  console.log('  Slot 3 – DM Evening   16:30–18:30  Classroom A  Tue/Thu/Sat  →  25 students');
  console.log('  Slot 4 – VE Night     19:00–21:00  Classroom B  Tue/Thu/Sat  →  11 students');
  console.log('\nCourse Split:');
  console.log('  Digital Marketing: 42 students (60%)');
  console.log('  Video Editing:     28 students (40%)');
  console.log('\nAttendance range: 40%–100% (varied per student)');
  console.log(`Schedules seeded: ${createdSchedules.length} sessions`);
  console.log(`Attendance records: ${attendanceRecords.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async err => {
  console.error('Seeder failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});