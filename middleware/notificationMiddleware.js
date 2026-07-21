const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Message = require('../models/Message');
const Schedule = require('../models/Schedule');
const Assignment = require('../models/Assignment');
const Attendance = require('../models/Attendance');
const Lead = require('../models/Lead');
const LeaveRequest = require('../models/LeaveRequest');
const Announcement = require('../models/Announcement');
const { todayIST } = require('../utils/dateHelper');
const Student = require('../models/Student');
const logger = require('../utils/logger');

function getRoleProfileId(user, role) {
  if (role === 'teacher') return user.teacherProfileId || null;
  if (role === 'counsellor') return user.counsellorProfileId || null;
  if (role === 'student') return user.studentProfileId || null;
  return null;
}

function isUnread(user, id) {
  return !user.readNotifications || !user.readNotifications.includes(String(id));
}

function truncateText(value, maxLength = 90) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isGradingPendingSubmission(submission) {
  return ['submitted', 'late'].includes(submission.status) && submission.marks === null;
}

async function getAnnouncementAlerts(user) {
  const audience = [
    { audienceType: 'all' },
    { audienceType: 'role', role: user.role }
  ];

  if (user.role === 'student') {
    const studentProfile = getRoleProfileId(user, 'student')
      ? await Student.findById(getRoleProfileId(user, 'student')).populate({
        path: 'counsellor',
        populate: { path: 'user', select: '_id' }
      })
      : await Student.findOne({ user: user._id }).populate({
        path: 'counsellor',
        populate: { path: 'user', select: '_id' }
      });

    if (studentProfile?.course) {
      audience.push({ audienceType: 'course', course: studentProfile.course });
    }
    if (studentProfile?.batch) {
      audience.push({ audienceType: 'batch', batch: studentProfile.batch });
    }
    if (studentProfile?.counsellor?.user?._id) {
      audience.push({ audienceType: 'counsellor', counsellor: studentProfile.counsellor.user._id });
    }
  }

  const announcements = await Announcement.find({
    isActive: true,
    createdBy: { $ne: user._id },
    $or: audience
  })
    .populate('createdBy', 'name role')
    .sort({ createdAt: -1 })
    .limit(8);

  return announcements.map(ann => ({
    id: `ann-${ann._id}`,
    type: 'announcement',
    title: ann.title,
    message: truncateText(ann.content, 100),
    link: `/${user.role}/dashboard`,
    date: ann.createdAt,
    senderId: ann.createdBy?._id?.toString() || null
  }));
}

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
      const senderId = m.sender ? m.sender._id.toString() : null;
      const isAssignmentGrade = /^Assignment graded:/i.test(m.content || '');
      alerts.push({
        id: m._id.toString(),
        type: isAssignmentGrade ? 'assignment_graded' : 'message',
        senderId,
        title: isAssignmentGrade
          ? 'Assignment Graded'
          : `Message from ${m.sender ? m.sender.name : 'System'}`,
        message: truncateText(m.content, 100),
        link: senderId ? `/auth/inbox?chat=${senderId}` : '/auth/inbox',
        date: m.createdAt
      });
    });

    const announcementAlerts = await getAnnouncementAlerts(user);
    alerts.push(...announcementAlerts);

    // 2. Role-specific alerts
    if (user.role === 'admin') {
      const incompleteStaff = await User.find({ profileIncomplete: true }).select('name role updatedAt').limit(10);
      incompleteStaff.forEach(staff => alerts.push({
        id: `incomplete-staff-${staff._id}`,
        type: 'profile_request',
        title: 'Temporary Staff Profile',
        message: `Complete ${staff.name}'s ${staff.role} account before they start work.`,
        link: `/admin/users/${staff._id}/edit`,
        date: staff.updatedAt
      }));

      // Ready to convert leads alert
      const readyLeads = await Lead.find({ status: 'joining_interested' }).limit(5);
      readyLeads.forEach(l => {
        alerts.push({
          id: `ready-${l._id}`,
          type: 'ready_to_convert',
          title: 'Lead Handoff Alert',
          message: `Lead "${l.name}" is ready to convert.`,
          link: `/admin/leads/${l._id}/convert`,
          date: l.updatedAt
        });
      });

      const automatedLeads = await Lead.find({ leadType: 'automation' })
        .populate({
          path: 'assignedTo',
          populate: { path: 'user', select: 'name' }
        })
        .sort({ createdAt: -1 })
        .limit(8);
      automatedLeads.forEach(l => {
        alerts.push({
          id: `ad-lead-${l._id}`,
          type: 'lead_created',
          title: 'New Ad Lead',
          message: `${l.name} from ${l.source}. Assigned to ${l.assignedTo?.user?.name || 'Unassigned'}.`,
          link: `/admin/leads/${l._id}`,
          date: l.createdAt
        });
      });

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

      const profileRequests = await Student.find({
        'pendingProfileUpdate.requestedAt': { $ne: null }
      })
        .populate('user', 'name')
        .sort({ 'pendingProfileUpdate.requestedAt': -1 })
        .limit(5);
      profileRequests.forEach(s => {
        alerts.push({
          id: `profile-request-${s._id}`,
          type: 'profile_request',
          title: 'Profile Update Request',
          message: `${s.user?.name || 'A student'} submitted profile changes for approval.`,
          link: '/admin/profile-requests',
          date: s.pendingProfileUpdate?.requestedAt
        });
      });

      // KYC Document Verification Requests
      try {
        const kycRequests = await Student.find({
          'documents.idProof': { $ne: null, $ne: '' },
          idVerified: false
        })
          .populate('user', 'name')
          .sort({ updatedAt: -1 })
          .limit(5);

        kycRequests.forEach(s => {
          alerts.push({
            id: `kyc-request-${s._id}`,
            type: 'kyc_request',
            title: 'KYC Verification Pending',
            message: `${s.user?.name || 'A student'} uploaded their ID proof for verification.`,
            link: `/admin/students/${s._id}`,
            date: s.updatedAt
          });
        });
      } catch (kycErr) {
        logger.error('Error fetching KYC requests for notifications', { err: kycErr.message });
      }

      const pendingLeaves = await LeaveRequest.find({ status: 'pending' })
        .populate('user', 'name role')
        .sort({ appliedAt: -1, createdAt: -1 })
        .limit(5);
      pendingLeaves.forEach(l => {
        alerts.push({
          id: `leave-request-${l._id}`,
          type: 'leave_request',
          title: 'Leave Request Pending',
          message: `${l.user?.name || 'Staff'} requested leave approval.`,
          link: '/admin/holidays-leaves',
          date: l.appliedAt || l.createdAt
        });
      });

      // Overdue fees
      const now = new Date();
      const fees = await Fee.find({ dueDate: { $lt: now } })
        .populate({
          path: 'student',
          select: 'user',
          populate: { path: 'user', select: 'name' }
        })
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
        alerts.push({
          id: f._id.toString(),
          type: 'fee_overdue',
          title: 'Fee Overdue Alert',
          message: `${f.student.user?.name || 'Student'}'s fees are overdue (Rs. ${due}).`,
          link: `/admin/fees/${f.student._id}`,
          date: f.updatedAt
        });
      });

    } else if (user.role === 'teacher') {
      const teacherProfileId = getRoleProfileId(user, 'teacher');
      if (!teacherProfileId) return alerts;

      // Upcoming schedules today
      const schedules = await Schedule.find({
        teacher: teacherProfileId,
        date: todayStr, // Simple string match works perfectly
        status: 'scheduled'
      })
        .populate('course', 'name')
        .populate('batch', 'name')
        .sort({ startTime: 1 });

      const currentMinutes = today.getHours() * 60 + today.getMinutes();
      schedules.forEach(s => {
        const endMinutes = timeToMinutes(s.endTime);
        const shouldComplete = endMinutes !== null && currentMinutes >= endMinutes;
        alerts.push({
          id: shouldComplete ? `complete-${s._id}` : s._id.toString(),
          type: shouldComplete ? 'class_completion_due' : 'schedule',
          title: shouldComplete ? 'Mark Class Complete' : 'Class Scheduled Today',
          message: shouldComplete
            ? `${s.course?.name || s.note || 'Class'} for ${s.batch?.name || 'Batch'} ended at ${s.endTime}. Mark it complete, then post the daily update.`
            : `${s.course?.name || s.note || 'Class'} for ${s.batch?.name || 'Batch'} at ${s.startTime} - ${s.endTime}`,
          link: '/teacher/dashboard',
          date: s.date
        });
      });

      // Ungraded submissions
      const activeAssignments = await Assignment.find({ teacher: teacherProfileId, isActive: true })
        .populate({
          path: 'submissions.student',
          populate: { path: 'user', select: 'name' }
        });

      activeAssignments.forEach(a => {
        a.submissions.forEach(sub => {
          if (isGradingPendingSubmission(sub)) {
            alerts.push({
              id: sub._id.toString(),
              type: 'grading_pending',
              title: 'Grading Pending',
              message: `${sub.student?.user?.name || 'Student'} submitted ${a.title}`,
              link: `/teacher/assignments/${a._id}#submission-${sub._id}`,
              date: sub.submittedAt
            });
          }
        });
      });

    } else if (user.role === 'counsellor') {
      const counsellorProfileId = getRoleProfileId(user, 'counsellor');
      if (!counsellorProfileId) return alerts;

      const newlyAssignedLeads = await Lead.find({
        assignedTo: counsellorProfileId,
        status: { $nin: ['admission_completed', 'lost'] }
      })
        .sort({ createdAt: -1 })
        .limit(8);

      newlyAssignedLeads.forEach(l => {
        alerts.push({
          id: `assigned-lead-${l._id}`,
          type: 'lead_assigned',
          title: 'Lead Assigned',
          message: `${l.name} from ${l.source}. Follow-up: ${l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleString('en-IN') : 'not scheduled'}.`,
          link: `/counsellor/leads/${l._id}`,
          date: l.createdAt
        });
      });

      const followUpsDue = await Lead.find({
        assignedTo: counsellorProfileId,
        status: { $nin: ['admission_completed', 'lost'] },
        nextFollowUpAt: { $lte: todayEnd }
      })
        .sort({ nextFollowUpAt: 1 })
        .limit(8);

      followUpsDue.forEach(l => {
        alerts.push({
          id: `lead-followup-${l._id}`,
          type: 'lead_followup_due',
          title: 'Lead Follow-up Due',
          message: `${l.name} needs follow-up today.`,
          link: `/counsellor/leads/${l._id}`,
          date: l.nextFollowUpAt || l.updatedAt
        });
      });

      // Stale leads (Follow-Up Gap > 5 days)
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const leads = await Lead.find({
        assignedTo: counsellorProfileId,
        status: { $nin: ['admission_completed', 'lost'] }
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
      const enrolledProfiles = await Student.find({ counsellor: counsellorProfileId })
        .populate('user', 'name status')
        .lean();
      const enrolledStudents = enrolledProfiles
        .filter(p => p.user)
        .map(p => ({
          _id: p._id,
          userId: p.user._id,
          name: p.user.name,
          status: p.user.status,
          batch: p.batch
        }));
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
          const batchStudents = enrolledStudents.filter(s => s.batch && a.batch && s.batch.toString() === a.batch.toString());
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
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

        const fees = await Fee.find({
          student: { $in: studentIds },
          dueDate: { $lte: tenDaysFromNow }
        }).populate({
          path: 'student',
          select: 'user',
          populate: { path: 'user', select: 'name' }
        }).limit(15);

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
              message: `${f.student.user?.name || 'Student'}'s fee of Rs. ${due.toLocaleString('en-IN')} is ${overdue ? 'overdue' : 'due soon'}.`,
              link: '/counsellor/admissions',
              date: f.dueDate
            });
          }
        });
      }

    } else if (user.role === 'student') {
      // Fee reminders
      const sp = getRoleProfileId(user, 'student')
        ? await Student.findById(getRoleProfileId(user, 'student'))
        : await Student.findOne({ user: user._id });
      const fee = sp ? await Fee.findOne({ student: sp._id }) : null;
      const dueAmount = fee ? Math.max(0, (fee.totalAmount || 0) - (fee.discount || 0) - (fee.paidAmount || 0)) : 0;
      if (fee && dueAmount > 0 && fee.dueDate) {
        const dueDate = new Date(fee.dueDate);
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          alerts.push({
            id: fee._id.toString(),
            type: 'fee_overdue',
            title: '⚠️ Fee Overdue Warning',
            message: `Your fee installment of ₹${dueAmount} is overdue by ${Math.abs(diffDays)} days!`,
            link: '/student/fees',
            date: fee.dueDate
          });
        } else if (diffDays <= 10) {
          alerts.push({
            id: fee._id.toString(),
            type: 'fee_due_soon',
            title: 'Fee Installment Reminder',
            message: `Your fee of ₹${dueAmount} is due in ${diffDays} days (${dueDate.toISOString().split('T')[0]}).`,
            link: '/student/fees',
            date: fee.dueDate
          });
        }
      }

      // Low attendance warning
      const attendanceRecords = sp ? await Attendance.find({ student: sp._id }) : [];
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
        batch: sp?.batch,
        date: todayStr, // Simple string match works perfectly
        status: 'scheduled'
      }).sort({ startTime: 1 });

      schedules.forEach(s => {
        alerts.push({
          id: s._id.toString(),
          type: 'schedule',
          title: 'Class Scheduled Today',
          message: `${s.note || 'Class'} at ${s.startTime} - ${s.endTime}`,
          link: '/student/dashboard',
          date: s.date
        });
      });

      // Upcoming Homework deadlines (unsubmitted)
      const assignments = await Assignment.find({
        batch: sp?.batch,
        isActive: true,
        dueDate: { $gte: today }
      });

      const pendingAssignments = assignments.filter(
        a => !a.submissions.some(s => s.student.toString() === (sp?._id.toString() || ''))
      );

      pendingAssignments.forEach(a => {
        alerts.push({
          id: a._id.toString(),
          type: 'homework_due',
          title: 'Assignment Deadline',
          message: `Pending homework: "${a.title}" is due by ${a.dueDate.toISOString().split('T')[0]}`,
          link: `/student/assignments#assignment-${a._id}`,
          date: a.dueDate
        });
      });
    }

  } catch (err) {
    logger.error('Error compiling dynamic alerts', { err: err.message, stack: err.stack });
  }

  // Filter out alerts that have been marked as read/dismissed by the user
  const unreadAlerts = alerts.filter(a => isUnread(user, a.id));

  // Sort alerts chronologically (latest first)
  return unreadAlerts.sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateB - dateA;
  });
}

async function calculateSidebarBadges(user) {
  const badges = {
    resetRequests: 0,
    feesOverdue: 0,
    ungradedAssignments: 0,
    staleLeads: 0,
    unreadMessages: 0,
    readyToConvert: 0,
    profileRequests: 0,
    pendingLeaves: 0
  };
  const today = new Date();
  try {
    // Unread messages count for all users
    badges.unreadMessages = await Message.countDocuments({ recipient: user._id, read: false });

    if (user.role === 'admin') {
      badges.resetRequests = await User.countDocuments({ resetRequested: true });
      badges.readyToConvert = await Lead.countDocuments({ status: 'joining_interested' });
      badges.profileRequests = await Student.countDocuments({ 'pendingProfileUpdate.requestedAt': { $ne: null } });
      badges.pendingLeaves = await LeaveRequest.countDocuments({ status: 'pending' });
      const overdueFeeRaw = await Fee.find({ dueDate: { $lt: today } })
        .select('totalAmount discount paidAmount')
        .lean();
      badges.feesOverdue = overdueFeeRaw.filter(f => {
        const net = (f.totalAmount || 0) - (f.discount || 0);
        return Math.max(0, net - (f.paidAmount || 0)) > 0;
      }).length;
    } else if (user.role === 'teacher') {
      const teacherProfileId = getRoleProfileId(user, 'teacher');
      const activeAssignments = teacherProfileId
        ? await Assignment.find({ teacher: teacherProfileId, isActive: true })
        : [];
      let ungradedCount = 0;
      activeAssignments.forEach(a => {
        a.submissions.forEach(sub => {
          if (isGradingPendingSubmission(sub)) {
            ungradedCount++;
          }
        });
      });
      badges.ungradedAssignments = ungradedCount;
    } else if (user.role === 'counsellor') {
      const counsellorProfileId = getRoleProfileId(user, 'counsellor');
      if (!counsellorProfileId) return badges;
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const leads = await Lead.find({
        assignedTo: counsellorProfileId,
        status: { $nin: ['admission_completed', 'lost'] }
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
    logger.error('Error calculating sidebar badges', { err: err.message, stack: err.stack });
  }
  return badges;
}

const populateNotifications = async (req, res, next) => {
  // Skip execution for static assets (Issue 3.6)
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/) || req.url.startsWith('/uploads/')) {
    return next();
  }

  res.locals.notifications = [];
  res.locals.greeting = '';
  res.locals.sidebarBadges = {
    resetRequests: 0,
    feesOverdue: 0,
    ungradedAssignments: 0,
    staleLeads: 0,
    readyToConvert: 0,
    profileRequests: 0,
    pendingLeaves: 0,
    unreadMessages: 0
  };

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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vande_secret_key');
      const user = await User.findById(decoded.id).select('-password');
      if (user && (user.isActive || user.status === 'complete')) {
        req.user = user;
        res.locals.user = user;
        // DB queries removed from middleware per Day 5 performance rules
        res.locals.notifications = [];
        res.locals.sidebarBadges = {};
      }
    } catch (err) {
      // Token expired or invalid, let auth protect middleware handle routing redirects later
    }
  }

  next();
};

module.exports = {
  populateNotifications,
  calculateNotifications,
  calculateSidebarBadges
};
