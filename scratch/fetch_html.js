const mongoose = require('mongoose');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
require('../models/Classroom');
require('../models/User');
require('../models/Timetable');
const Schedule = require('../models/Schedule');

// Mock request and response
async function run() {
  await mongoose.connect('mongodb://localhost:27017/vande_academy');
  console.log('Connected to DB');
  
  const User = mongoose.model('User');
  const Classroom = mongoose.model('Classroom');
  const Timetable = mongoose.model('Timetable');

  const admin = await User.findOne({ role: 'admin' });
  const [classrooms, teachers, batches] = await Promise.all([
    Classroom.find({ isActive: true }).sort({ name: 1 }),
    User.find({ role: 'teacher', isActive: true }).sort({ name: 1 }),
    User.distinct('batch', { role: 'student', isActive: true })
  ]);

  const monthParam = "2026-06";
  const [year, month] = monthParam.split('-').map(Number);
  
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0); 
  const daysInMonth = endOfMonth.getDate();
  
  let startDayOfWeek = startOfMonth.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; 

  const startDateStr = "2026-06-01";
  const endDateStr = "2026-06-30";

  const monthSchedules = await Schedule.find({
    date: { $gte: startDateStr, $lte: endDateStr }
  }).populate('teacher', 'name').populate('classroom', 'name').sort({ startTime: 1 });

  const monthSchedulesGrouped = {};
  for (let d = 1; d <= daysInMonth; d++) {
    monthSchedulesGrouped[d] = [];
  }
  monthSchedules.forEach(s => {
    const dayNum = parseInt(s.date.split('-')[2], 10);
    if (monthSchedulesGrouped[dayNum]) {
      monthSchedulesGrouped[dayNum].push(s);
    }
  });

  const timelineClassroomData = {};
  classrooms.forEach(cr => {
    timelineClassroomData[cr._id.toString()] = [];
  });

  const allSchedules = await Schedule.find({})
    .populate('teacher', 'name')
    .populate('classroom', 'name')
    .sort({ date: -1, startTime: 1 });

  const timetables = await Timetable.find({})
    .populate('slots.teacher', 'name')
    .populate('slots.classroom', 'name');

  const ejsData = {
    title: 'Class Schedules',
    user: admin,
    schedules: allSchedules,
    teachers,
    batches,
    classrooms,
    monthParam,
    prevMonthStr: '2026-05',
    nextMonthStr: '2026-07',
    currentMonthLabel: 'June 2026',
    dayParam: '2026-06-06',
    monthSchedulesGrouped,
    timelineClassroomData,
    daysInMonth,
    startDayOfWeek,
    timetables,
    filter: { batch: '', teacherId: '', status: '', search: '' },
    page: 'schedules'
  };

  const templatePath = path.join(__dirname, '../views/admin/schedules.ejs');
  const templateHtml = fs.readFileSync(templatePath, 'utf8');

  // We mock res.render by calling ejs.render
  // EJS includes require/layout helper etc, but we can do simple compile if layout isn't loaded or mock layout
  // To avoid layout dependency issues, we can just compile and catch errors or mock EJS layout
  // EJS layout is typically registered in express, but since we use express-ejs-layouts:
  // Let's render the file:
  try {
    const html = ejs.render(templateHtml, ejsData, {
      filename: templatePath
    });
    // Write day 1 cell snippet to console
    console.log(html.substring(5000, 7000));
  } catch (err) {
    console.error('EJS Render Error:', err);
  }

  await mongoose.disconnect();
}
run();
