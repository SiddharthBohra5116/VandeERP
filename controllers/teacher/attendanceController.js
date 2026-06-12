const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const Schedule = require('../../models/Schedule');
const Holiday = require('../../models/Holiday');
const { todayIST } = require('../../utils/dateHelper');
const Course = require('../../models/Course');

/**
 * GET /teacher/attendance
 * Shows the attendance marking form for a specific batch + subject + date.
 * If batch and subject are not provided via query params, only the filter
 * dropdowns are shown (no student list is loaded).
 */
exports.getAttendancePage = async (req, res) => {
  const { batch, subject, date } = req.query;
  const today = date || todayIST();
  console.log('📋 Teacher Attendance Page load:', { teacherId: req.user._id, batch, subject, date: today });

  try {
    let students = [];
    let existing = [];

    if (batch && subject) {
      [students, existing] = await Promise.all([
        User.find({
          role: 'student',
          batch: { $regex: new RegExp('^' + batch.trim() + '$', 'i') },
          status: { $in: ['active', 'inactive'] }
        }).sort({ name: 1 }),
        Attendance.find({ batch, date: today }),
      ]);
      console.log('✅ Attendance page data fetched:', {
        batch, subject, date: today,
        studentCount: students.length,
        existingRecords: existing.length,
      });
    }

    // Fetch all active student batches across the academy
    const batches = await User.distinct('batch', { role: 'student', isActive: true });

    // Fetch unique subjects
    let subjects = await Schedule.distinct('subject');
    if (!subjects) {
      subjects = [];
    }
    // Also merge the teacher's profile subject if available
    if (req.user.subject && !subjects.includes(req.user.subject)) {
      subjects.push(req.user.subject);
    }
    const noSubjectsConfigured = subjects.length === 0;

    res.render('teacher/attendance', {
      title: 'Mark Attendance',
      user: req.user,
      students,
      existing,
      batches,
      subjects,
      noSubjectsConfigured,
      filter: { batch: batch || '', subject: subject || '', date: today },
    });
  } catch (err) {
    console.error('❌ Teacher Attendance Page Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /teacher/attendance
 * Saves attendance records for a batch + subject + date using bulkWrite upsert,
 * so re-submitting the same date overwrites rather than duplicating records.
 * Blocks submissions on configured holidays.
 */
exports.postMarkAttendance = async (req, res) => {
  const { batch, subject, date, statuses, notes } = req.body;
  const courseDoc = await Course.findOne({ name: subject });
  const courseId = courseDoc ? courseDoc._id : null;
  console.log('📝 Mark Attendance request:', {
    teacherId: req.user._id, batch, subject, date,
    statusesCount: Object.keys(statuses || {}).length,
  });

  try {
    if (req.user.role !== 'admin') {
      const validBatch = await Schedule.findOne({ teacher: req.user._id, batch, subject });
      if (!validBatch) {
        console.warn(`⚠️ Teacher unauthorized attendance attempt: teacher ${req.user._id} attempted batch ${batch} with subject ${subject}`);
        return res.status(403).render('403', { title: 'Access Denied', user: req.user });
      }
    }

    const isHoliday = await Holiday.findOne({ date });
    if (isHoliday) {
      console.warn('⚠️ Attendance attempt on a holiday:', { date, holiday: isHoliday.name });
      return res.redirect(`/teacher/attendance?error=Cannot mark attendance on ${isHoliday.name}`);
    }

    if (!statuses || Object.keys(statuses).length === 0) {
      return res.redirect(`/teacher/attendance?batch=${batch}&subject=${subject}&date=${date}&error=1`);
    }

    const ops = Object.entries(statuses).map(([studentId, status]) => ({
      updateOne: {
        filter: { student: studentId, date },
        update: {
          $set: { student: studentId, teacher: req.user._id, course: courseId, batch, date, status, note: notes?.[studentId] || '' },
        },
        upsert: true,
      },
    }));

    const result = await Attendance.bulkWrite(ops);
    console.log('✅ Attendance marked successfully:', {
      batch, subject, date, upserted: result.upsertedCount, modified: result.modifiedCount,
    });
    res.redirect(`/teacher/attendance?batch=${batch}&subject=${subject}&date=${date}&saved=1`);
  } catch (err) {
    console.error('❌ Mark Attendance Error:', { batch, subject, date, error: err.message });
    res.redirect('/teacher/attendance?error=1');
  }
};

/**
 * GET /teacher/attendance/history
 * Shows historical attendance records marked by this teacher,
 * filterable by batch, subject, and month (YYYY-MM format).
 */
exports.getAttendanceHistory = async (req, res) => {
  const { batch, subject, month } = req.query;
  console.log('📅 Attendance History load:', { teacherId: req.user._id, batch, subject, month });

  try {
    const filter = { teacher: req.user._id };
    if (batch) filter.batch = batch;
    if (month) filter.date = { $regex: `^${month}` };

    const [records, batches] = await Promise.all([
      Attendance.find(filter).populate('student', 'name').sort({ date: -1 }),
      User.distinct('batch', { role: 'student', isActive: true }),
    ]);

    console.log('✅ Attendance History fetched:', { recordCount: records.length });
    res.render('teacher/attendance-history', {
      title: 'Attendance History',
      user: req.user,
      records,
      batches,
      filter: req.query,
    });
  } catch (err) {
    console.error('❌ Attendance History Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};