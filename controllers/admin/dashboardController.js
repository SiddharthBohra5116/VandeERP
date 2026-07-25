const User = require('../../models/User');
const Student = require('../../models/Student');
const Fee = require('../../models/Fee');
const Lead = require('../../models/Lead');
const Schedule = require('../../models/Schedule');
const Attendance = require('../../models/Attendance');
const Assignment = require('../../models/Assignment');
const LeaveRequest = require('../../models/LeaveRequest');

const { todayIST } = require('../../utils/dateHelper');
const { calculateStudentsAttendance } = require('../../utils/attendanceHelper');
const logger = require('../../utils/logger');
const getFeeStatus = require('../../utils/feeStatus');

exports.getDashboard = async (req, res) => {
  try {
    const todayStr = todayIST();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const isToday = (dateValue) => {
      if (!dateValue) return false;

      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      return formatter.format(new Date(dateValue)) === todayStr;
    };

    // Today fee collections
    const fees = await Fee.find().select('payments');

    let todayCollections = 0;

    fees.forEach(fee => {
      if (!fee.payments) return;

      fee.payments.forEach(payment => {
        if (isToday(payment.paidAt)) {
          todayCollections += payment.amount;
        }
      });
    });

    const now = new Date();
    const feeStats = fees.reduce((stats, fee) => {
      const status = getFeeStatus(fee, now).paymentStatus;
      if (status === 'completed') stats.completed += 1;
      else if (status === 'overdue') stats.overdue += 1;
      else if (status === 'partially_paid') stats.partial += 1;
      else stats.pending += 1;
      return stats;
    }, { completed: 0, overdue: 0, partial: 0, pending: 0 });

    // Today schedules
    const todaySchedules = await Schedule
      .find({ date: todayStr })
      .select('status');

    const todayScheduledCount = todaySchedules.length;

    const todayCompletedCount = todaySchedules.filter(
      schedule => schedule.status === 'completed'
    ).length;

    // Leads ready to convert
    const readyLeadsCount = await Lead.countDocuments({
      status: 'joining_interested'
    });
    const [highPotentialLeads, newLeads, loopLeads, convertedLeads, completedStudents] = await Promise.all([
      Lead.countDocuments({ status: 'high_potential' }),
      Lead.countDocuments({ status: 'new' }),
      Lead.countDocuments({ status: 'in_the_loop' }),
      Lead.countDocuments({ status: 'admission_completed' }),
      User.countDocuments({ role: 'student', status: 'complete', archivedAt: null })
    ]);

    // At-risk students
    const studentProfiles = await Student
      .find()
      .populate('user', 'name role status');

    const activeStudentProfiles = studentProfiles.filter(student => {
      return (
        student.user &&
        student.user.status === 'active'
      );
    });

    const studentIds = activeStudentProfiles.map(student => student._id);

    const [attendanceRecords, todayRecords] = await Promise.all([
      Attendance.find({ student: { $in: studentIds } }),
      Attendance.find({
        date: todayStr,
        student: { $in: studentIds }
      })
    ]);

    const studentsForAttendance = activeStudentProfiles.map(student => {
      const plainStudent = student.toObject();

      plainStudent.name = student.user.name;
      plainStudent.role = student.user.role;
      plainStudent.status = student.user.status;

      return plainStudent;
    });

    await calculateStudentsAttendance(
      studentsForAttendance,
      attendanceRecords,
      todayRecords
    );

    const atRiskCount = studentsForAttendance.filter(
      student => student.attendancePct < 75
    ).length;

    // Pending leave requests
    const pendingLeavesCount = await LeaveRequest.countDocuments({
      status: 'pending'
    });

    // Ungraded submissions
    const assignmentsList = await Assignment.find().select('submissions');

    let ungradedSubmissionsCount = 0;

    assignmentsList.forEach(assignment => {
      if (!assignment.submissions) return;

      assignment.submissions.forEach(submission => {
        if (submission.marks === null || submission.marks === undefined) {
          ungradedSubmissionsCount++;
        }
      });
    });

    // Recent students
    const recentStudents = await Student.find()
      .populate('user', 'name email phone status profilePic')
      .populate('course', 'name code')
      .populate('batch', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Hot leads
    const hotLeads = await Lead.find({
      status: {
        $in: [
          'contacted',
          'mentorship_scheduled',
          'mentorship_attended',
          'follow_up',
          'joining_interested'
        ]
      }
    })
      .sort({ nextFollowUpAt: 1, followUpDate: 1 })
      .limit(5)
      .populate({ path: 'assignedTo', populate: { path: 'user', select: 'name' } })
      .populate('interestedCourse', 'name code');

    const recentLeads = await Lead.find({ createdAt: { $gte: threeDaysAgo } })
      .populate('interestedCourse', 'name')
      .populate({ path: 'assignedTo', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 });

    const resetRequests = await User.find({ resetRequested: true })
      .select('name email phone role updatedAt')
      .sort({ updatedAt: -1 })
      .limit(25);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.user,
      stats: {
        todayCollections,
        todayScheduledCount,
        todayCompletedCount,
        readyLeadsCount,
        atRiskCount,
        pendingLeavesCount,
        ungradedSubmissionsCount,
        highPotentialLeads,
        newLeads,
        loopLeads,
        convertedLeads,
        completedStudents,
        feeStats
      },
      recentStudents,
      recentLeads,
      hotLeads,
      resetRequests
    });

  } catch (err) {
    logger.error('Admin Dashboard Fetch Error', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};
