const Attendance = require('../../models/Attendance');
const { filterValidAttendance } = require('../../utils/attendanceHelper');

/**
 * GET /student/attendance
 * Shows the student's own attendance log, optionally filtered by month (YYYY-MM).
 * Computes overall present %, total classes, and absent count from valid records.
 */
exports.getAttendance = async (req, res) => {
  try {
    const { month } = req.query;
    const filter = { student: req.user._id };
    if (month) filter.date = { $regex: `^${month}` };

    const records = await Attendance.find(filter).sort({ date: -1 });
    const validAttendance = await filterValidAttendance(records);
    const presentCount = validAttendance.filter(r => r.status === 'present' || r.status === 'late').length;
    const total = validAttendance.length;
    const pct = total ? Math.round((presentCount / total) * 100) : 0;

    res.render('student/attendance', {
      title: 'My Attendance',
      user: req.user,
      records: validAttendance,
      stats: { presentCount, total, pct, absent: total - presentCount },
      filter: req.query,
    });
  } catch (err) {
    console.error('❌ Student Attendance Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};