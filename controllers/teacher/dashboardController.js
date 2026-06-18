const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const Assignment = require('../../models/Assignment');
const DailyUpdate = require('../../models/DailyUpdate');
const Message = require('../../models/Message');
const Schedule = require('../../models/Schedule');
const Announcement = require('../../models/Announcement');
const { todayIST } = require('../../utils/dateHelper');

/**
 * GET /teacher/dashboard
 * Loads the teacher's main dashboard:
 *   - Upcoming assignments they created (due in future, max 5)
 *   - Count of students they marked attendance for today
 *   - Their 5 most recent daily updates
 *   - Inbox messages sent to them (max 5)
 *   - Upcoming class schedules (today onwards, max 5)
 *   - Weekly timetable grid for the current (or offset) week
 */
exports.getDashboard = async (req, res) => {
  const today = todayIST();
  console.log('📊 Teacher Dashboard load:', { teacherId: req.user._id, today });

  try {
    const [pendingAssignments, todayAttendance, recentUpdates, messages, schedules, admin, todaySchedules, activeAnnouncements] = await Promise.all([
      Assignment.find({ teacher: req.user.teacherProfileId, isActive: true, dueDate: { $gte: new Date() } })
        .populate('batch', 'name')
        .sort({ dueDate: 1 }).limit(5),
      Attendance.countDocuments({ teacher: req.user.teacherProfileId, date: today }),
      DailyUpdate.find({ teacher: req.user.teacherProfileId }).populate('course', 'name code').populate('batch', 'name').sort({ createdAt: -1 }).limit(5),
      Message.find({ recipient: req.user._id }).populate('sender', 'name role').sort({ createdAt: -1 }).limit(5),
      Schedule.find({ teacher: req.user.teacherProfileId, date: { $gte: today } })
        .populate('course', 'name code')
        .populate('batch', 'name')
        .populate('classroom', 'name location').sort({ date: 1, startTime: 1 }).limit(5),
      User.findOne({ role: 'admin' }),
      Schedule.find({ teacher: req.user.teacherProfileId, date: today })
        .populate('course', 'name code')
        .populate('batch', 'name')
        .populate('classroom', 'name location').sort({ startTime: 1 }),
      Announcement.find({
        isActive: true,
        $or: [
          { audienceType: 'all' },
          { audienceType: 'role', role: 'teacher' }
        ]
      }).populate('createdBy', 'name role').sort({ createdAt: -1 }).limit(5)
    ]);

    const mappedAnnouncements = (activeAnnouncements || []).map(ann => ({
      _id: ann._id,
      content: `📢 [${ann.title}] ${ann.content}`,
      sender: ann.createdBy,
      createdAt: ann.createdAt
    }));

    const combinedMessages = [...mappedAnnouncements, ...(messages || [])];

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
      teacher: req.user.teacherProfileId,
      date: { $in: dateStrings },
      status: { $ne: 'cancelled' },
    })
      .populate('course', 'name code')
      .populate('batch', 'name')
      .populate('classroom', 'name location')
      .sort({ startTime: 1 });

    const daysTimetable = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
    const { parseTimeToMinutes } = require('../../utils/clashDetector');

    weekSchedules.forEach(s => {
      const [yr, mo, dy] = s.date.split('-').map(Number);
      const dayName = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', { weekday: 'long' });
      if (daysTimetable[dayName]) daysTimetable[dayName].push(s);
    });

    Object.keys(daysTimetable).forEach(day => {
      daysTimetable[day].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
    });

    console.log('✅ Teacher Dashboard loaded:', {
      pendingAssignments: pendingAssignments.length,
      todayAttendance,
      recentUpdates: recentUpdates.length,
      upcomingSchedules: schedules.length,
    });

    res.render('teacher/dashboard', {
      title: 'Teacher Dashboard',
      user: req.user,
      todayAttendance: todayAttendance || 0,
      pendingAssignments: pendingAssignments || [],
      messages: combinedMessages || [],
      schedules: schedules || [],
      todaySchedules: todaySchedules || [],
      recentUpdates: recentUpdates || [],
      daysTimetable,
      weekDates,
      weekOffset,
    });
  } catch (err) {
    console.error('❌ Teacher Dashboard Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};