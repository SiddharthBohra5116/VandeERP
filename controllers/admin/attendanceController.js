const Attendance = require('../../models/Attendance');
const Student = require('../../models/Student');
const Batch = require('../../models/Batch');
const Holiday = require('../../models/Holiday');

const { todayIST } = require('../../utils/dateHelper');
const { filterValidAttendance } = require('../../utils/attendanceHelper');
const logger = require('../../utils/logger');

exports.getAttendanceOverview = async (req, res) => {
  try {
    const { batch = '', month = '' } = req.query;

    const todayISTStr = todayIST();
    const defaultMonth = todayISTStr.slice(0, 7);
    const selectedMonth = month || defaultMonth;

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

          studentRecords.forEach(record => {
            attendanceByDate[record.date] = record.status;
          });

          return {
            _id: student._id,
            userId: student.user?._id,
            name: student.user?.name || 'Unknown Student',
            batch: student.batch?.name || '',
            course: student.course?.name || '',
            attendanceByDate
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