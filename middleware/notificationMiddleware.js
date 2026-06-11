const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Message = require('../models/Message');
const Schedule = require('../models/Schedule');
const Assignment = require('../models/Assignment');
const Attendance = require('../models/Attendance');
const Lead = require('../models/Lead');
const { todayIST } = require('../utils/dateHelper');

async function calculateNotifications(user) {
  const alerts = [];
  const today = new Date();
  const todayStr = todayIST();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  try {
    // 1. Fetch unread messages for all roles
    const unreadMsgs = await Message.find({ recipient: user._id, read: false })
      .populate('sender', 'name role')
      .sort({ createdAt: -1 })
      .limit(5);

    unreadMsgs.forEach(m => {
      alerts.push({
        id: m._id.toString(),
        type: 'message',
<<<<<<< HEAD
        senderId: m.sender ? m.sender._id.toString() : null,
=======
>>>>>>> origin/main
        title: `Message from ${m.sender ? m.sender.name : 'System'}`,
        message: m.content.length > 60 ? `${m.content.substring(0, 57)}...` : m.content,
        link: user.role === 'admin' ? '/admin/dashboard' : `/${user.role}/dashboard`,
        date: m.createdAt
      });
    });

    // 2. Role-specific alerts
    if (user.role === 'admin') {
<<<<<<< HEAD
      // Ready to convert leads alert
      const readyLeads = await Lead.find({ status: 'ready_to_convert' }).limit(5);
      readyLeads.forEach(l => {
        alerts.push({
          id: l._id.toString(),
          type: 'ready_to_convert',
          title: 'Lead Handoff Alert',
          message: `Lead "${l.name}" is ready to convert.`,
          link: `/admin/leads/${l._id}/convert`,
          date: l.updatedAt
        });
      });

=======
>>>>>>> origin/main
      // Password Reset Requests
      const resetUsers = await User.find({ resetRequested: true }).limit(5);
      resetUsers.forEach(u => {
        alerts.push({
          id: u._id.toString(),
          type: 'reset_request',
          title: 'Password Reset Request',
          message: `${u.name} (${u.role}) requested a password reset.`,
          link: '/admin/dashboard',
          date: u.updatedAt
        });
      });

      // Overdue fees
<<<<<<< HEAD
      const now = new Date();
      const fees = await Fee.find({ dueDate: { $lt: now } })
        .populate('student', 'name _id')
        .limit(20)
        .lean();
      const overdueFees = fees.filter(f => {
        const net = (f.totalAmount || 0) - (f.discount || 0);
        const due = Math.max(0, net - (f.paidAmount || 0));
        return f.student && due > 0;
      });
      overdueFees.slice(0, 5).forEach(f => {
        const net = (f.totalAmount || 0) - (f.discount || 0);
        const due = Math.max(0, net - (f.paidAmount || 0));
=======
      const fees = await Fee.find().populate('student');
      const overdueFees = fees.filter(f => f.student && f.dueAmount > 0 && f.dueDate && new Date(f.dueDate) < today);
      overdueFees.slice(0, 5).forEach(f => {
>>>>>>> origin/main
        alerts.push({
          id: f._id.toString(),
          type: 'fee_overdue',
          title: 'Fee Overdue Alert',
<<<<<<< HEAD
          message: `${f.student.name}'s fees are overdue (₹${due}).`,
=======
          message: `${f.student.name}'s fees are overdue (₹${f.dueAmount}).`,
>>>>>>> origin/main
          link: `/admin/fees/${f.student._id}`,
          date: f.updatedAt
        });
      });

    } else if (user.role === 'teacher') {
      // Upcoming schedules today
      const schedules = await Schedule.find({
        teacher: user._id,
        date: todayStr, // Simple string match works perfectly
        status: 'scheduled'
      }).sort({ startTime: 1 });

      schedules.forEach(s => {
        alerts.push({
          id: s._id.toString(),
          type: 'schedule',
          title: 'Class Scheduled Today',
          message: `${s.subject} for ${s.batch} at ${s.startTime} - ${s.endTime}`,
          link: '/teacher/dashboard',
          date: s.date
        });
      });

      // Ungraded submissions
      const activeAssignments = await Assignment.find({ teacher: user._id, isActive: true })
        .populate('submissions.student', 'name');

      activeAssignments.forEach(a => {
        a.submissions.forEach(sub => {
          if (sub.marks === null || sub.status === 'submitted' || sub.status === 'late') {
            alerts.push({
              id: sub._id.toString(),
              type: 'grading_pending',
              title: 'Grading Pending',
              message: `${sub.student ? sub.student.name : 'Student'} submitted ${a.title}`,
<<<<<<< HEAD
              link: `/teacher/assignments/${a._id}#submission-${sub._id}`,
=======
              link: '/teacher/assignments',
>>>>>>> origin/main
              date: sub.submittedAt
            });
          }
        });
      });

    } else if (user.role === 'counsellor') {
      // Stale leads (Follow-Up Gap > 5 days)
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const leads = await Lead.find({
        assignedTo: user._id,
        status: { $nin: ['converted', 'lost'] }
      });

      leads.forEach(l => {
        let isStale = false;
        let lastDate = l.createdAt;

        if (l.followUpHistory && l.followUpHistory.length > 0) {
          const lastFollowup = l.followUpHistory[l.followUpHistory.length - 1];
          lastDate = lastFollowup.doneAt || lastDate;
        }

        if (new Date(lastDate) < fiveDaysAgo) {
          isStale = true;
        }

        if (isStale) {
          alerts.push({
            id: l._id.toString(),
            type: 'followup_gap',
            title: 'Stale Lead Alert',
            message: `Lead ${l.name} has no contact log for 5+ days.`,
            link: `/counsellor/leads/${l._id}`,
            date: lastDate
          });
        }
      });

      // Converted/assigned students metrics
      const enrolledStudents = await User.find({ role: 'student', counsellor: user._id });
      if (enrolledStudents.length > 0) {
        const studentIds = enrolledStudents.map(s => s._id);

        // A. Low Attendance Alerts
        const attendanceRecords = await Attendance.find({ student: { $in: studentIds } });
        enrolledStudents.forEach(s => {
          const studentAttendance = attendanceRecords.filter(a => a.student.toString() === s._id.toString());
          if (studentAttendance.length >= 5) { // Check once they have a baseline of 5 classes
            const presentCount = studentAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
            const attendancePct = Math.round((presentCount / studentAttendance.length) * 100);
            if (attendancePct < 75) {
              alerts.push({
                id: `cns-low-att-${s._id}`,
                type: 'low_attendance',
                title: '🔴 Low Attendance Risk',
                message: `${s.name}'s attendance is at ${attendancePct}% (under 75%).`,
                link: '/counsellor/admissions',
                date: today
              });
            }
          }
        });

        // B. Unsubmitted Overdue Assignments Alerts
        const studentBatches = [...new Set(enrolledStudents.map(s => s.batch).filter(Boolean))];
        const overdueAssignments = await Assignment.find({
          batch: { $in: studentBatches },
          isActive: true,
          dueDate: { $lt: today }
        });

        overdueAssignments.forEach(a => {
          // Filter students of this batch
          const batchStudents = enrolledStudents.filter(s => s.batch === a.batch);
          batchStudents.forEach(s => {
            const hasSubmitted = a.submissions.some(sub => sub.student.toString() === s._id.toString());
            if (!hasSubmitted) {
              alerts.push({
                id: `cns-miss-assign-${s._id}-${a._id}`,
                type: 'homework_overdue',
                title: '⚠️ Homework Not Submitted',
                message: `${s.name} missed homework deadline for "${a.title}".`,
                link: '/counsellor/admissions',
                date: a.dueDate
              });
            }
          });
        });

        // C. Fees Reminders (Due / Overdue)
<<<<<<< HEAD
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

        const fees = await Fee.find({
          student: { $in: studentIds },
          dueDate: { $lte: tenDaysFromNow }
        }).populate('student', 'name _id').limit(15);

        fees.forEach(f => {
          const net = (f.totalAmount || 0) - (f.discount || 0);
          const due = Math.max(0, net - (f.paidAmount || 0));
          if (f.student && due > 0 && f.dueDate) {
            const dueDate = new Date(f.dueDate);
            const overdue = dueDate < today;
            alerts.push({
              id: f._id.toString(),
              type: overdue ? 'fee_overdue' : 'fee_due_soon',
              title: overdue ? '💵 Converted Student Fee Overdue' : '💵 Converted Student Fee Due',
              message: `${f.student.name}'s fee of ₹${due.toLocaleString('en-IN')} is ${overdue ? 'overdue' : 'due soon'}.`,
              link: '/counsellor/admissions',
              date: f.dueDate
            });
=======
        const fees = await Fee.find({ student: { $in: studentIds } }).populate('student');
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

        fees.forEach(f => {
          if (f.student && f.dueAmount > 0 && f.dueDate) {
            const dueDate = new Date(f.dueDate);
            if (dueDate <= tenDaysFromNow) {
              const overdue = dueDate < today;
              alerts.push({
                id: f._id.toString(),
                type: overdue ? 'fee_overdue' : 'fee_due_soon',
                title: overdue ? '💵 Converted Student Fee Overdue' : '💵 Converted Student Fee Due',
                message: `${f.student.name}'s fee of ₹${f.dueAmount} is ${overdue ? 'overdue' : 'due soon'}.`,
                link: '/counsellor/admissions',
                date: f.dueDate
              });
            }
>>>>>>> origin/main
          }
        });
      }

    } else if (user.role === 'student') {
      // Fee reminders
      const fee = await Fee.findOne({ student: user._id });
      if (fee && fee.dueAmount > 0 && fee.dueDate) {
        const dueDate = new Date(fee.dueDate);
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          alerts.push({
            id: fee._id.toString(),
            type: 'fee_overdue',
            title: '⚠️ Fee Overdue Warning',
            message: `Your fee installment of ₹${fee.dueAmount} is overdue by ${Math.abs(diffDays)} days!`,
            link: '/student/fees',
            date: fee.dueDate
          });
        } else if (diffDays <= 10) {
          alerts.push({
            id: fee._id.toString(),
            type: 'fee_due_soon',
            title: 'Fee Installment Reminder',
            message: `Your fee of ₹${fee.dueAmount} is due in ${diffDays} days (${dueDate.toISOString().split('T')[0]}).`,
            link: '/student/fees',
            date: fee.dueDate
          });
        }
      }

      // Low attendance warning
      const attendanceRecords = await Attendance.find({ student: user._id });
      if (attendanceRecords.length > 0) {
        const presentCount = attendanceRecords.filter(a => a.status === 'present').length;
        const attendancePct = Math.round((presentCount / attendanceRecords.length) * 100);

        if (attendancePct < 75) {
          alerts.push({
            id: 'attendance-low',
            type: 'low_attendance',
            title: '🔴 Low Attendance Alert',
            message: `Your attendance is ${attendancePct}%, which is below the required 75% limit.`,
            link: '/student/attendance',
            date: today
          });
        }
      }

      // Upcoming class schedules today
      const schedules = await Schedule.find({
        batch: user.batch,
        date: todayStr, // Simple string match works perfectly
        status: 'scheduled'
      }).sort({ startTime: 1 });

      schedules.forEach(s => {
        alerts.push({
          id: s._id.toString(),
          type: 'schedule',
          title: 'Class Scheduled Today',
          message: `${s.subject} at ${s.startTime} - ${s.endTime}`,
          link: '/student/dashboard',
          date: s.date
        });
      });

      // Upcoming Homework deadlines (unsubmitted)
      const assignments = await Assignment.find({
        batch: user.batch,
        isActive: true,
        dueDate: { $gte: today }
      });

      const pendingAssignments = assignments.filter(
        a => !a.submissions.some(s => s.student.toString() === user._id.toString())
      );

      pendingAssignments.forEach(a => {
        alerts.push({
          id: a._id.toString(),
          type: 'homework_due',
          title: 'Assignment Deadline',
          message: `Pending homework: "${a.title}" is due by ${a.dueDate.toISOString().split('T')[0]}`,
<<<<<<< HEAD
          link: `/student/assignments#assignment-${a._id}`,
=======
          link: '/student/assignments',
>>>>>>> origin/main
          date: a.dueDate
        });
      });
    }

  } catch (err) {
    console.error('❌ Error compiling dynamic alerts:', err);
  }

  // Filter out alerts that have been marked as read/dismissed by the user
  const unreadAlerts = alerts.filter(a => !user.readNotifications || !user.readNotifications.includes(a.id));

  // Sort alerts chronologically (latest first)
<<<<<<< HEAD
  return unreadAlerts.sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateB - dateA;
  });
=======
  return unreadAlerts.sort((a, b) => new Date(b.date) - new Date(a.date));
>>>>>>> origin/main
}

async function calculateSidebarBadges(user) {
  const badges = {
    resetRequests: 0,
    feesOverdue: 0,
    ungradedAssignments: 0,
    staleLeads: 0,
<<<<<<< HEAD
    unreadMessages: 0,
    readyToConvert: 0
=======
    unreadMessages: 0
>>>>>>> origin/main
  };
  const today = new Date();
  try {
    // Unread messages count for all users
    badges.unreadMessages = await Message.countDocuments({ recipient: user._id, read: false });

    if (user.role === 'admin') {
      badges.resetRequests = await User.countDocuments({ resetRequested: true });
<<<<<<< HEAD
      badges.readyToConvert = await Lead.countDocuments({ status: 'ready_to_convert' });
      const overdueFeeRaw = await Fee.find({ dueDate: { $lt: today } })
        .select('totalAmount discount paidAmount')
        .lean();
      badges.feesOverdue = overdueFeeRaw.filter(f => {
        const net = (f.totalAmount || 0) - (f.discount || 0);
        return Math.max(0, net - (f.paidAmount || 0)) > 0;
      }).length;
=======
      const fees = await Fee.find();
      badges.feesOverdue = fees.filter(f => f.dueAmount > 0 && f.dueDate && new Date(f.dueDate) < today).length;
>>>>>>> origin/main
    } else if (user.role === 'teacher') {
      const activeAssignments = await Assignment.find({ teacher: user._id, isActive: true });
      let ungradedCount = 0;
      activeAssignments.forEach(a => {
        a.submissions.forEach(sub => {
          if (sub.marks === null || sub.status === 'submitted' || sub.status === 'late') {
            ungradedCount++;
          }
        });
      });
      badges.ungradedAssignments = ungradedCount;
    } else if (user.role === 'counsellor') {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const leads = await Lead.find({
        assignedTo: user._id,
        status: { $nin: ['converted', 'lost'] }
      });
      let staleCount = 0;
      leads.forEach(l => {
        let lastDate = l.createdAt;
        if (l.followUpHistory && l.followUpHistory.length > 0) {
          const lastFollowup = l.followUpHistory[l.followUpHistory.length - 1];
          lastDate = lastFollowup.doneAt || lastDate;
        }
        if (new Date(lastDate) < fiveDaysAgo) {
          staleCount++;
        }
      });
      badges.staleLeads = staleCount;
    }
  } catch (err) {
    console.error('❌ Error calculating sidebar badges:', err);
  }
  return badges;
}

const populateNotifications = async (req, res, next) => {
<<<<<<< HEAD
  // Skip execution for static assets (Issue 3.6)
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/) || req.url.startsWith('/uploads/')) {
    return next();
  }

  res.locals.notifications = [];
  res.locals.greeting = '';
  res.locals.sidebarBadges = { resetRequests: 0, feesOverdue: 0, ungradedAssignments: 0, staleLeads: 0, readyToConvert: 0 };
=======
  res.locals.notifications = [];
  res.locals.greeting = '';
  res.locals.sidebarBadges = { resetRequests: 0, feesOverdue: 0, ungradedAssignments: 0, staleLeads: 0 };
>>>>>>> origin/main

  // 1. Time-aware greeting calculation
  const hour = new Date().getHours();
  let greetingMsg = 'Good Evening';
  if (hour < 12) greetingMsg = 'Good Morning';
  else if (hour < 17) greetingMsg = 'Good Afternoon';

  res.locals.greeting = greetingMsg;

  // 2. Fetch token to check if user session is available
  let token;
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
<<<<<<< HEAD
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET configuration is missing on the server.');
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
=======
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vande_secret_key');
>>>>>>> origin/main
      const user = await User.findById(decoded.id).select('-password');
      if (user && (user.isActive || user.status === 'complete')) {
        req.user = user;
        res.locals.user = user;
<<<<<<< HEAD
        // DB queries removed from middleware per Day 5 performance rules
        res.locals.notifications = [];
        res.locals.sidebarBadges = {};
=======
        res.locals.notifications = await calculateNotifications(user);
        res.locals.sidebarBadges = await calculateSidebarBadges(user);
>>>>>>> origin/main
      }
    } catch (err) {
      // Token expired or invalid, let auth protect middleware handle routing redirects later
    }
  }

  next();
};

<<<<<<< HEAD
module.exports = {
  populateNotifications,
  calculateNotifications,
  calculateSidebarBadges
};
=======
module.exports = populateNotifications;
>>>>>>> origin/main
