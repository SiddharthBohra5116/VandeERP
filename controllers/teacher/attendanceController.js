const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const Schedule = require('../../models/Schedule');
const Holiday = require('../../models/Holiday');
const { todayIST } = require('../../utils/dateHelper');
const Course = require('../../models/Course');
const Batch = require('../../models/Batch');
const Student = require('../../models/Student');
const syncCourseCompletion = require('../../utils/syncCourseCompletion');

/**
 * GET /teacher/attendance
 * Shows the attendance marking form for a specific batch + course + date.
 * If batch and course are not provided via query params, only the filter
 * dropdowns are shown (no student list is loaded).
 */
exports.getAttendancePage = async (req, res) => {
  const { batch, course } = req.query;
  const today = todayIST(); // Lock to today
  console.log('📋 Teacher Attendance Page load:', { teacherId: req.user._id, batch, course, date: today });

  try {
    let students = [];
    let existing = [];
    const mongoose = require('mongoose');

    let timeSlot = '';
    let isTimeValid = true;
    let scheduleError = '';

    if (batch && course) {
      if (mongoose.Types.ObjectId.isValid(batch) && mongoose.Types.ObjectId.isValid(course)) {
        const studentProfiles = await Student.find({ batch })
          .populate('user', 'name status');

        students = studentProfiles
          .filter(sp => sp.user)
          .map(sp => ({
            _id: sp._id,
            name: sp.user.name,
            status: sp.user.status
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        existing = await Attendance.find({ batch, course, date: today });

        // Retrieve time slot for this batch today
        const scheduleDoc = await Schedule.findOne({
          teacher: req.user.teacherProfileId,
          batch,
          course,
          date: today
        });

        if (scheduleDoc) {
          timeSlot = `${scheduleDoc.startTime} - ${scheduleDoc.endTime}`;

          // Current time in IST check (HH:MM format)
          const nowStr = new Date().toLocaleTimeString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });

          const { parseTimeToMinutes } = require('../../utils/clashDetector');
          const nowMinutes = parseTimeToMinutes(nowStr);
          const startMinutes = parseTimeToMinutes(scheduleDoc.startTime);

          if (nowMinutes < startMinutes) {
            isTimeValid = false;
            scheduleError = `Attendance marking is locked until class starts at ${scheduleDoc.startTime} IST (Current time: ${nowStr} IST).`;
          }
        } else {
          isTimeValid = false;
          scheduleError = `No class session scheduled for this Batch and Course today (${today}).`;
        }
      }
    }

    // Fetch all schedules for this teacher to build dynamic dependent select dropdowns
    const teacherSchedules = await Schedule.find({ teacher: req.user.teacherProfileId })
      .populate('batch', 'name')
      .populate('course', 'name');

    // Build lists of unique batches and courses the teacher is assigned to
    const Teacher = require('../../models/Teacher');
    
    // Get batches assigned via schedules
    const scheduledBatches = await Schedule.distinct('batch', { teacher: req.user.teacherProfileId });
    
    // Get batches assigned directly in the Batch model
    const directlyAssignedBatches = await Batch.distinct('_id', { 
      $or: [
        { teachers: req.user._id },
        { teachers: req.user.teacherProfileId }
      ]
    });
    
    const allAssignedBatchIds = Array.from(new Set([
      ...scheduledBatches.map(id => id.toString()),
      ...directlyAssignedBatches.map(id => id.toString())
    ])).map(id => new mongoose.Types.ObjectId(id));

    const batches = await Batch.find({ _id: { $in: allAssignedBatchIds }, isActive: true }).select('name course');

    // Get unique course IDs from all assigned batches
    const assignedCoursesFromBatches = batches.map(b => b.course ? b.course.toString() : null).filter(Boolean);

    const teacherProfile = await Teacher.findById(req.user.teacherProfileId);
    const profileCourseIds = teacherProfile && teacherProfile.courses 
      ? teacherProfile.courses.map(id => id.toString()) 
      : [];

    const allCourseIds = Array.from(new Set([...profileCourseIds, ...assignedCoursesFromBatches]));

    const courses = await Course.find({ _id: { $in: allCourseIds } }).select('name');
    const noCoursesConfigured = courses.length === 0;

    if (!batch && !course && courses.length === 1 && batches.length === 1) {
      return res.redirect(`/teacher/attendance?course=${courses[0]._id}&batch=${batches[0]._id}`);
    }

    const attendanceSummary = existing.reduce((summary, record) => {
      summary.total += 1;
      if (record.status === 'present') summary.present += 1;
      if (record.status === 'absent') summary.absent += 1;
      if (record.status === 'late') summary.late += 1;
      return summary;
    }, { total: 0, present: 0, absent: 0, late: 0 });
    const attendanceSaved = Boolean(batch && course && students.length > 0 && attendanceSummary.total >= students.length);
    const allowAttendanceEdit = req.query.edit === '1';

    res.render('teacher/attendance', {
      title: 'Mark Attendance',
      user: req.user,
      students,
      existing,
      attendanceSaved,
      attendanceSummary,
      allowAttendanceEdit,
      batches,
      courses,
      teacherSchedules,
      timeSlot,
      isTimeValid,
      scheduleError,
      noCoursesConfigured,
      filter: { batch: batch || '', course: course || '', date: today },
    });
  } catch (err) {
    console.error('❌ Teacher Attendance Page Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /teacher/attendance
 * Saves attendance records for a batch + course + date using bulkWrite upsert,
 * so re-submitting the same date overwrites rather than duplicating records.
 * Blocks submissions on configured holidays.
 */
exports.postMarkAttendance = async (req, res) => {
  const { batch, course, date, statuses, notes } = req.body;
  const mongoose = require('mongoose');
  const today = todayIST(); // Lock server-side date strictly to today

  if (!mongoose.Types.ObjectId.isValid(batch) || !mongoose.Types.ObjectId.isValid(course)) {
    return res.redirect('/teacher/attendance?error=invalid_params');
  }

  console.log('📝 Mark Attendance request:', {
    teacherId: req.user._id, batch, course, date: today,
    statusesCount: Object.keys(statuses || {}).length,
  });

  try {
    const validBatch = await Schedule.findOne({ 
      teacher: req.user.teacherProfileId, 
      batch, 
      course,
      date: today
    });

    if (!validBatch) {
      console.warn(`⚠️ Teacher unauthorized attendance attempt: teacher ${req.user._id} attempted batch ${batch} with course ${course}`);
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }

    // Check time slot block
    const nowStr = new Date().toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const { parseTimeToMinutes } = require('../../utils/clashDetector');
    if (parseTimeToMinutes(nowStr) < parseTimeToMinutes(validBatch.startTime)) {
      return res.redirect(`/teacher/attendance?batch=${batch}&course=${course}&error=Attendance marking opens at ${validBatch.startTime} IST.`);
    }

    const isHoliday = await Holiday.findOne({ date: today });
    if (isHoliday) {
      console.warn('⚠️ Attendance attempt on a holiday:', { today, holiday: isHoliday.name });
      return res.redirect(`/teacher/attendance?error=Cannot mark attendance on ${isHoliday.name}`);
    }

    if (!statuses || Object.keys(statuses).length === 0) {
      return res.redirect(`/teacher/attendance?batch=${batch}&course=${course}&error=No statuses provided.`);
    }

    const ops = Object.entries(statuses).map(([studentId, status]) => ({
      updateOne: {
        filter: { student: studentId, date: today },
        update: {
          $set: {
            student: studentId,
            teacher: req.user.teacherProfileId,
            course,
            batch,
            date: today,
            status,
            note: notes?.[studentId] || ''
          },
        },
        upsert: true,
      },
    }));

    const result = await Attendance.bulkWrite(ops);
    await syncCourseCompletion(Object.keys(statuses), req.user._id);
    console.log('✅ Attendance marked successfully:', {
      batch, course, date: today, upserted: result.upsertedCount, modified: result.modifiedCount,
    });
    res.redirect(`/teacher/attendance?batch=${batch}&course=${course}&saved=1`);
  } catch (err) {
    console.error('❌ Mark Attendance Error:', { batch, course, date: today, error: err.message });
    res.redirect('/teacher/attendance?error=1');
  }
};

/**
 * GET /teacher/attendance/history
 * Shows historical attendance records marked by this teacher,
 * filterable by batch, course, and month (YYYY-MM format).
 */
exports.getAttendanceHistory = async (req, res) => {
  const { batch, course, month, range } = req.query;
  console.log('📅 Attendance History load:', { teacherId: req.user._id, batch, course, month, range });

  try {
    const filter = { teacher: req.user.teacherProfileId };
    const mongoose = require('mongoose');
    
    if (batch && mongoose.Types.ObjectId.isValid(batch)) {
      filter.batch = batch;
    }
    
    if (course && mongoose.Types.ObjectId.isValid(course)) {
      filter.course = course;
    }
    
    const formatDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const now = new Date();
    const activeRange = month ? '' : (range || 'this_month');

    if (month) {
      filter.date = { $regex: `^${month}` };
    } else if (activeRange === 'last_7') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      filter.date = { $gte: formatDate(start), $lte: formatDate(now) };
    } else if (activeRange === 'last_30') {
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      filter.date = { $gte: formatDate(start), $lte: formatDate(now) };
    } else if (activeRange === 'this_month') {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      filter.date = { $regex: `^${monthStart}` };
    }

    const Teacher = require('../../models/Teacher');
    const assignedBatches = await Schedule.distinct('batch', { teacher: req.user.teacherProfileId });
    
    const [records, batches, courses, teacherSchedules] = await Promise.all([
      Attendance.find(filter)
        .populate({
          path: 'student',
          populate: {
            path: 'user',
            select: 'name'
          }
        })
        .populate('course', 'name code')
        .populate('batch', 'name')
        .sort({ date: -1 }),
      Batch.find({ _id: { $in: assignedBatches }, isActive: true }).select('name'),
      Teacher.findById(req.user.teacherProfileId).then(tp => 
        Course.find({ _id: { $in: tp ? tp.courses : [] } }).select('name')
      ),
      Schedule.find({ teacher: req.user.teacherProfileId })
        .populate('batch', 'name')
        .populate('course', 'name')
    ]);

    // Group records by Date + Batch + Course
    const sessionsMap = {};
    records.forEach(r => {
      if (!r.batch || !r.course) return;
      const batchId = r.batch._id.toString();
      const courseId = r.course._id.toString();
      const key = `${r.date}_${batchId}_${courseId}`;

      if (!sessionsMap[key]) {
        sessionsMap[key] = {
          date: r.date,
          batchName: r.batch.name,
          courseName: r.course.name,
          batchId: batchId,
          courseId: courseId,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          totalCount: 0,
          roster: []
        };
      }

      sessionsMap[key].totalCount++;
      if (r.status === 'present') sessionsMap[key].presentCount++;
      else if (r.status === 'absent') sessionsMap[key].absentCount++;
      else if (r.status === 'late') sessionsMap[key].lateCount++;

      sessionsMap[key].roster.push({
        studentName: r.student ? (r.student.user ? r.student.user.name : 'Unknown Student') : 'Deleted Student',
        status: r.status,
        note: r.note || ''
      });
    });

    const sessions = Object.values(sessionsMap).sort((a, b) => b.date.localeCompare(a.date));
    const absentRoster = records
      .filter(r => r.status === 'absent')
      .map(r => ({
        studentName: r.student ? (r.student.user ? r.student.user.name : 'Unknown Student') : 'Deleted Student',
        date: r.date,
        courseName: r.course ? r.course.name : 'Course',
        batchName: r.batch ? r.batch.name : 'Batch',
        note: r.note || ''
      }));

    console.log('✅ Attendance History fetched:', { recordCount: records.length, sessionCount: sessions.length });
    res.render('teacher/attendance-history', {
      title: 'Attendance History',
      user: req.user,
      records,
      sessions,
      absentRoster,
      batches,
      courses,
      teacherSchedules,
      filter: { batch: batch || '', course: course || '', month: month || '', range: activeRange },
    });
  } catch (err) {
    console.error('❌ Attendance History Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};
