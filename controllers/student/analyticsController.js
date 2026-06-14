const Student = require('../../models/Student');
const Attendance = require('../../models/Attendance');
const Assignment = require('../../models/Assignment');
const Progress = require('../../models/Progress');
const Fee = require('../../models/Fee');
const Curriculum = require('../../models/Curriculum');

const logger = require('../../utils/logger');

exports.getAnalytics = async (req, res) => {
  try {
    const studentProfile = await Student.findOne({
      user: req.user._id
    })
      .populate('user', 'name email phone status')
      .populate('course', 'name code')
      .populate('batch', 'name');

    if (!studentProfile) {
      return res.render('student/analytics', {
        title: 'My Analytics Dashboard',
        user: req.user,
        attendanceTrend: [],
        assignmentScores: [],
        avgTestScores: [],
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
    const attendanceList = await Attendance.find({
      student: studentId
    }).sort({ date: 1 });

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
    const assignments = batchId
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
    const progressList = await Progress.find({
      student: studentId
    })
      .populate('course', 'name code')
      .populate('teacher', 'name');

    const avgTestScores = progressList.map(progress => ({
      subject: progress.course?.name || studentProfile.course?.name || 'Course',
      course: progress.course?.name || studentProfile.course?.name || 'Course',
      module: 'General',
      score: progress.overallScore
    }));

    // 4. Fee Payment Status
    const fee = await Fee.findOne({
      student: studentId
    });

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

    const curriculums = await Curriculum.find(curriculumQuery)
      .populate('course');

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
