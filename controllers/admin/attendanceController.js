const Attendance = require('../../models/Attendance');
const Student = require('../../models/Student');
const Batch = require('../../models/Batch');
const Holiday = require('../../models/Holiday');

const { todayIST, isValidDateString } = require('../../utils/dateHelper');
const { filterValidAttendance } = require('../../utils/attendanceHelper');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');
const { ATTENDANCE_STATUSES } = require('../../config/constants');
const syncCourseCompletion = require('../../utils/syncCourseCompletion');

exports.getAttendanceOverview = async (req, res) => {
  try {
    const { batch = '', month = '', date = '' } = req.query;

    const todayISTStr = todayIST();
    const defaultMonth = todayISTStr.slice(0, 7);
    const requestedDate = isValidDateString(date) ? date : '';
    const selectedMonth = requestedDate ? requestedDate.slice(0, 7) : month || defaultMonth;
    const selectedDate = requestedDate
      ? requestedDate
      : selectedMonth === defaultMonth ? todayISTStr : `${selectedMonth}-01`;

    const [year, monthNum] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    const holidaysList = await Holiday.find({
      date: { $regex: '^' + selectedMonth }
    });

    const holidayDates = new Set(holidaysList.map(h => h.date));
    const holidayMap = {};

    holidaysList.forEach(h => {
      holidayMap[h.date] = h.name;
    });

    const calendarDays = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, monthNum - 1, day);

      calendarDays.push({
        dateStr,
        dayNum: day,
        dayOfWeek: dateObj.getDay(),
        isHoliday: holidayDates.has(dateStr),
        holidayName: holidayMap[dateStr] || null,
        attendancePct: null,
        totalStudentsMarked: 0,
        presentCount: 0
      });
    }

    const batches = await Batch.find({ isActive: true })
      .populate('course', 'name code')
      .sort({ name: 1 });

    const studentFilter = {};

    if (batch) {
      studentFilter.batch = batch;
    }

    let students = await Student.find(studentFilter)
      .populate('user', 'name email phone status')
      .populate('course', 'name code')
      .populate('batch', 'name')
      .sort({ createdAt: -1 });

    students = students.filter(student => student.user && student.user.status === 'active');

    let monthlyAttendanceRecords = [];
    let gridDates = [];
    let studentGrid = [];

    if (students.length > 0) {
      const studentIds = students.map(student => student._id);

      monthlyAttendanceRecords = await Attendance.find({
        student: { $in: studentIds },
        date: { $regex: '^' + selectedMonth }
      })
        .populate({
          path: 'student',
          populate: {
            path: 'user',
            select: 'name'
          }
        })
        .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
        .populate('batch', 'name')
        .populate('course', 'name code');

      const validMonthlyRecords = await filterValidAttendance(monthlyAttendanceRecords);

      calendarDays.forEach(day => {
        const dayRecords = validMonthlyRecords.filter(
          record => record.date === day.dateStr
        );

        if (dayRecords.length > 0) {
          const total = dayRecords.length;

          const present = dayRecords.filter(record =>
            record.status === 'present' || record.status === 'late'
          ).length;

          day.attendancePct = Math.round((present / total) * 100);
          day.totalStudentsMarked = total;
          day.presentCount = present;
        }
      });

      if (batch) {
        gridDates = calendarDays
          .filter(day => !day.isHoliday)
          .map(day => day.dateStr);

        studentGrid = students.map(student => {
          const studentRecords = validMonthlyRecords.filter(record => {
            const recordStudentId = record.student?._id || record.student;
            return String(recordStudentId) === String(student._id);
          });

          const attendanceByDate = {};
          const notesByDate = {};

          studentRecords.forEach(record => {
            attendanceByDate[record.date] = record.status;
            notesByDate[record.date] = record.note || '';
          });

          return {
            _id: student._id,
            userId: student.user?._id,
            name: student.user?.name || 'Unknown Student',
            batch: student.batch?.name || '',
            course: student.course?.name || '',
            attendanceByDate,
            notesByDate
          };
        });
      }
    }

    const batchSummaries = [];

    for (const batchDoc of batches) {
      const batchStudents = await Student.find({
        batch: batchDoc._id
      }).populate('user', 'status');

      const activeStudents = batchStudents.filter(student =>
        student.user && student.user.status === 'active'
      );

      if (activeStudents.length === 0) continue;

      const batchStudentIds = activeStudents.map(student => student._id);

      const batchRecords = await Attendance.find({
        student: { $in: batchStudentIds },
        date: { $regex: '^' + selectedMonth }
      });

      const validBatchRecords = await filterValidAttendance(batchRecords);

      let attendancePct = null;

      if (validBatchRecords.length > 0) {
        const total = validBatchRecords.length;

        const present = validBatchRecords.filter(record =>
          record.status === 'present' || record.status === 'late'
        ).length;

        attendancePct = Math.round((present / total) * 100);
      }

      batchSummaries.push({
        _id: batchDoc._id,
        name: batchDoc.name,
        course: batchDoc.course?.name || '',
        studentCount: activeStudents.length,
        attendancePct
      });
    }

    const monthsList = [];
    const currentDate = new Date();

    for (let i = 0; i < 6; i++) {
      const tempDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1
      );

      const y = tempDate.getFullYear();
      const m = String(tempDate.getMonth() + 1).padStart(2, '0');

      monthsList.push({
        value: `${y}-${m}`,
        label: tempDate.toLocaleDateString('en-IN', {
          month: 'long',
          year: 'numeric'
        })
      });
    }
    if (!monthsList.some(item => item.value === selectedMonth)) {
      monthsList.push({
        value: selectedMonth,
        label: new Date(`${selectedMonth}-02`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      });
    }

    res.render('admin/attendance', {
      title: 'Attendance Overview',
      user: req.user,
      batch,
      selectedMonth,
      batches,
      calendarDays,
      gridDates,
      studentGrid,
      monthlyAttendanceRecords,
      selectedDate,
      today: todayISTStr,
      monthsList,
      batchSummaries
    });

  } catch (err) {
    logger.error('Error in getAttendanceOverview', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      message: 'Unable to load attendance overview.'
    });
  }
};

exports.postAdminAttendance = async (req, res) => {
  const { batch, date, statuses = {}, notes = {}, changeReason = '' } = req.body;
  const redirect = `/admin/attendance?batch=${encodeURIComponent(batch || '')}&month=${String(date || '').slice(0, 7)}&date=${encodeURIComponent(date || '')}`;

  try {
    if (!mongoose.Types.ObjectId.isValid(batch) || !isValidDateString(date) || date > todayIST()) {
      return res.redirect(`${redirect}&invalid_attendance=1`);
    }
    if (!String(changeReason).trim()) return res.redirect(`${redirect}&attendance_reason=1`);

    const [batchDoc, holiday] = await Promise.all([
      Batch.findById(batch).select('course startDate endDate'),
      Holiday.findOne({ date })
    ]);
    if (!batchDoc || !batchDoc.course || holiday) return res.redirect(`${redirect}&invalid_attendance=1`);

    const attendanceDate = new Date(`${date}T23:59:59.999Z`);
    if ((batchDoc.startDate && attendanceDate < batchDoc.startDate) || (batchDoc.endDate && new Date(`${date}T00:00:00.000Z`) > batchDoc.endDate)) {
      return res.redirect(`${redirect}&invalid_attendance=1`);
    }

    const students = await Student.find({ batch, enrollmentDate: { $lte: attendanceDate } }).select('_id');
    const studentIds = new Set(students.map(student => String(student._id)));
    const entries = Object.entries(statuses).filter(([studentId, status]) => studentIds.has(studentId) && ATTENDANCE_STATUSES.includes(status));
    if (!entries.length) return res.redirect(`${redirect}&attendance_empty=1`);

    const existing = await Attendance.find({ student: { $in: entries.map(([studentId]) => studentId) }, date });
    const existingByStudent = new Map(existing.map(record => [String(record.student), record]));
    const reason = String(changeReason).trim().slice(0, 300);
    const now = new Date();
    const ops = entries.flatMap(([studentId, status]) => {
      const record = existingByStudent.get(studentId);
      const note = String(notes[studentId] || '').trim().slice(0, 300);
      if (record && record.status === status && record.note === note) return [];

      const update = {
        $set: { student: studentId, course: batchDoc.course, batch, date, status, note, updatedBy: req.user._id, changeReason: reason, entrySource: 'admin' },
        $setOnInsert: { markedBy: req.user._id }
      };
      if (record) {
        update.$push = { revisions: { status: record.status, note: record.note, changedBy: req.user._id, changedAt: now, reason } };
      }
      return [{ updateOne: { filter: { student: studentId, date }, update, upsert: true } }];
    });

    if (ops.length) {
      await Attendance.bulkWrite(ops);
      await syncCourseCompletion(entries.map(([studentId]) => studentId), req.user._id);
    }
    res.redirect(`${redirect}&attendance_saved=1`);
  } catch (err) {
    logger.error('Admin attendance update failed', { error: err.message, batch, date, adminId: req.user._id });
    res.redirect(`${redirect}&error=1`);
  }
};
