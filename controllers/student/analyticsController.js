const Student = require('../../models/Student');
const Attendance = require('../../models/Attendance');
const Assignment = require('../../models/Assignment');
const Progress = require('../../models/Progress');
const Fee = require('../../models/Fee');
const Curriculum = require('../../models/Curriculum');

const logger = require('../../utils/logger');

exports.getAnalytics = async (req, res) => {
  try {
    const modules = res.locals.modules || {};
    const attendanceEnabled = modules.attendance !== false;
    const assignmentsEnabled = modules.assignments !== false;
    const progressEnabled = modules.progress !== false;
    const feesEnabled = modules.fees !== false;
    const curriculumEnabled = modules.curriculum !== false;
    const teachersEnabled = modules.teachers !== false;
    let studentQuery = Student.findOne({ user: req.user._id }).populate('user', 'name email phone status');
    if (modules.courses !== false) studentQuery = studentQuery.populate('course', 'name code');
    if (modules.batches !== false) studentQuery = studentQuery.populate('batch', 'name');
    const studentProfile = await studentQuery;

    if (!studentProfile) {
      return res.render('student/analytics', {
        title: 'My Analytics Dashboard',
        user: req.user,
        attendanceTrend: [],
        assignmentScores: [],
        avgTestScores: [],
        progressRecords: [],
        feeStatus: {
          totalBilled: 0,
          paidAmount: 0,
          outstandingAmount: 0,
          nextInstallmentDate: null
        },
        curriculumCompletion: [],
        page: 'analytics',
        notEnrolled: true
      });
    }

    const studentId = studentProfile._id;
    const batchId = studentProfile.batch?._id || studentProfile.batch;
    const courseId = studentProfile.course?._id || studentProfile.course;

    // 1. Attendance Trend week-by-week — last 8 weeks
    const attendanceList = attendanceEnabled ? await Attendance.find({
      student: studentId
    }).sort({ date: 1 }) : [];

    const weeks = [];
    const now = new Date();

    for (let i = 7; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

      weeks.push({
        label: `Wk -${i}`,
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10)
      });
    }

    const attendanceTrend = weeks.map(week => {
      const weekRecords = attendanceList.filter(record =>
        record.date >= week.start && record.date <= week.end
      );

      let pct = 0;

      if (weekRecords.length > 0) {
        const present = weekRecords.filter(record =>
          ['present', 'late'].includes(record.status)
        ).length;

        pct = Math.round((present / weekRecords.length) * 100);
      }

      return {
        label: week.label,
        pct
      };
    });

    // 2. Assignment Score History
    const assignments = assignmentsEnabled && batchId
      ? await Assignment.find({
        batch: batchId,
        isActive: true
      }).sort({ dueDate: 1 })
      : [];

    const assignmentScores = assignments.map(assignment => {
      const submission = assignment.submissions.find(sub =>
        String(sub.student) === String(studentId) &&
        sub.status === 'graded'
      );

      return {
        title: assignment.title,
        score: submission ? submission.marks : 0,
        totalMarks: assignment.totalMarks
      };
    });

    // 3. Test / Progress Scores
    let progressQuery = Progress.find(progressEnabled ? { student: studentId } : { _id: null }).populate('course', 'name code');
    if (teachersEnabled) progressQuery = progressQuery.populate({ path: 'teacher', populate: { path: 'user', select: 'name' } });
    const progressRecords = await progressQuery;

    const avgTestScores = progressRecords.map(progress => ({
      subject: progress.course?.name || studentProfile.course?.name || 'Course',
      course: progress.course?.name || studentProfile.course?.name || 'Course',
      module: 'General',
      score: progress.overallScore
    }));

    // 4. Fee Payment Status
    const fee = feesEnabled ? await Fee.findOne({
      student: studentId
    }) : null;

    let totalBilled = 0;
    let paidAmount = 0;
    let outstandingAmount = 0;
    let nextInstallmentDate = null;

    if (fee) {
      totalBilled = fee.totalAmount - (fee.discount || 0);
      paidAmount = fee.paidAmount;
      outstandingAmount = Math.max(0, totalBilled - paidAmount);

      if (fee.installments && fee.installments.length > 0) {
        const unpaid = fee.installments.find(inst =>
          inst.amount - (inst.paidAmount || 0) > 0
        );

        if (unpaid) {
          nextInstallmentDate = unpaid.dueDate;
        }
      } else {
        nextInstallmentDate = fee.dueDate;
      }
    }

    // 5. Curriculum Completion
    const curriculumQuery = {};

    if (batchId) {
      curriculumQuery.batch = batchId;
    }

    if (courseId) {
      curriculumQuery.course = courseId;
    }

    const curriculums = curriculumEnabled ? await Curriculum.find(curriculumQuery).populate('course') : [];

    const curriculumCompletion = curriculums.map(curriculum => ({
      subject: curriculum.course?.name || studentProfile.course?.name || 'Course',
      course: curriculum.course?.name || studentProfile.course?.name || 'Course',
      pct: curriculum.completionPct
    }));

    res.render('student/analytics', {
      title: 'My Analytics Dashboard',
      user: req.user,
      studentProfile,
      attendanceTrend,
      assignmentScores,
      avgTestScores,
      progressRecords,
      feeStatus: {
        totalBilled,
        paidAmount,
        outstandingAmount,
        nextInstallmentDate
      },
      curriculumCompletion,
      page: 'analytics'
    });

  } catch (err) {
    logger.error('Student Analytics Error', {
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
