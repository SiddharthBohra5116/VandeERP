const User = require('../../models/User');
const Student = require('../../models/Student');
const Attendance = require('../../models/Attendance');
const Assignment = require('../../models/Assignment');
const DailyUpdate = require('../../models/DailyUpdate');
const Fee = require('../../models/Fee');
const Message = require('../../models/Message');
const Schedule = require('../../models/Schedule');
const { filterValidAttendance } = require('../../utils/attendanceHelper');
const { todayIST } = require('../../utils/dateHelper');

/**
 * GET /student/dashboard
 * Loads the student's main dashboard with fee summary, attendance %, upcoming
 * assignments, timetable for the current week, and recent class updates.
 * Redirects to feedback form if student status is 'complete' but feedback not yet submitted.
 */
exports.getDashboard = async (req, res) => {
  try {
    const studentProfile = await Student.findOne({ user: req.user._id })
      .populate('user', 'name email phone status profilePic')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'counsellor', populate: { path: 'user', select: 'name' } });

    if (!studentProfile || !studentProfile.batch) {
      const fallbackUser = req.user.toObject ? req.user.toObject() : req.user;
      return res.render('student/dashboard', {
        title: 'My Dashboard', user: fallbackUser,
        fee: null, pendingAssignments: [], attendancePct: null,
        totalClasses: 0, presentCount: 0, updates: [], admin: null, messages: [], schedules: [],
        daysTimetable: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] },
        weekDates: [], weekOffset: 0,
        notEnrolled: true
      });
    }

    const student = studentProfile.toObject();
    student.name = studentProfile.user?.name || '';
    student.email = studentProfile.user?.email || '';
    student.phone = studentProfile.user?.phone || '';
    student.status = studentProfile.user?.status || 'active';
    student.profilePic = studentProfile.user?.profilePic || null;
    student.role = req.user.role || 'student';
    student.dob = studentProfile.user?.dob || null;
    student.address = studentProfile.user?.address || '';
    student.city = studentProfile.user?.city || '';
    student.fatherName = studentProfile.family?.father?.name || '';
    student.guardianPhone = studentProfile.family?.guardian?.phone || '';
    student.idProof = studentProfile.documents?.idProof || null;

    if (student.status === 'complete' && (!student.feedback || !student.feedback.submitted)) {
      return res.render('student/feedback', {
        title: 'Course Completion Feedback',
        user: student
      });
    }

    const today = todayIST();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { formatDateLocal } = require('../../utils/dateHelper');
    const thirtyDaysStr = formatDateLocal(thirtyDaysAgo);

    const [fee, assignments, attendance, updates, admin, messages, schedules] = await Promise.all([
      Fee.findOne({ student: student._id }),
      Assignment.find({ batch: student.batch, isActive: true, dueDate: { $gte: new Date() } }).sort({ dueDate: 1 }).limit(5),
      Attendance.find({ student: student._id, date: { $gte: thirtyDaysStr } }),
      DailyUpdate.find({ batch: student.batch }).sort({ date: -1 }).limit(5),
      User.findOne({ role: 'admin' }),
      Message.find({ recipient: student._id })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 })
        .limit(5),
      Schedule.find({ batch: student.batch, date: { $gte: today } })
        .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
        .populate('classroom', 'name location')
        .sort({ date: 1, startTime: 1 })
        .limit(5),
    ]);

    // ─── WEEKLY TIMETABLE ────────────────────────────────────────────────────
    const weekOffset = parseInt(req.query.weekOffset, 10) || 0;
    const activeDate = new Date();
    activeDate.setDate(activeDate.getDate() + weekOffset * 7);

    const curr = new Date(activeDate);
    const dayOfWeek = curr.getDay();
    const first = curr.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(first));
    monday.setHours(0, 0, 0, 0);

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d);
    }

    const dateStrings = weekDates.map(
      d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );

    const weekSchedules = await Schedule.find({
      batch: student.batch,
      date: { $in: dateStrings },
      status: { $ne: 'cancelled' },
    })
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
      .populate('classroom', 'name location')
      .sort({ startTime: 1 });

    const daysTimetable = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
    const { parseTimeToMinutes } = require('../../utils/clashDetector');

    weekSchedules.forEach(s => {
      const [yr, mo, dy] = s.date.split('-').map(Number);
      const dateObj = new Date(yr, mo - 1, dy);
      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(dateObj);
      if (daysTimetable[dayName]) daysTimetable[dayName].push(s);
    });

    Object.keys(daysTimetable).forEach(day => {
      daysTimetable[day].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
    });

    // ─── ATTENDANCE SUMMARY ──────────────────────────────────────────────────
    const validAttendance = await filterValidAttendance(attendance);
    const presentCount = validAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const attendancePct = validAttendance.length
      ? Math.round((presentCount / validAttendance.length) * 100)
      : 0;

    const pendingAssignments = assignments.filter(a => {
      const sub = a.submissions.find(s => s.student.toString() === student._id.toString());
      return !sub;
    });

    res.render('student/dashboard', {
      title: 'My Dashboard',
      user: student,
      fee,
      pendingAssignments,
      attendancePct,
      totalClasses: validAttendance.length,
      presentCount,
      updates,
      admin,
      messages,
      schedules,
      today,
      daysTimetable,
      weekDates,
      weekOffset,
    });
  } catch (err) {
    console.error('❌ Student Dashboard Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};