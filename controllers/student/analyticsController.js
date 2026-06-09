const Attendance = require('../../models/Attendance');
const Assignment = require('../../models/Assignment');
const Progress = require('../../models/Progress');
const Fee = require('../../models/Fee');
const Curriculum = require('../../models/Curriculum');
const logger = require('../../utils/logger');

exports.getAnalytics = async (req, res) => {
  try {
    const studentId = req.user._id;
    const batchName = req.user.batch;

    // 1. Attendance Trend week-by-week (last 8 weeks)
    const attendanceList = await Attendance.find({ student: studentId }).sort({ date: 1 });
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

    const attendanceTrend = weeks.map(w => {
      const weekRecs = attendanceList.filter(a => a.date >= w.start && a.date <= w.end);
      let pct = 0;
      if (weekRecs.length > 0) {
        const present = weekRecs.filter(a => ['present', 'late'].includes(a.status)).length;
        pct = Math.round((present / weekRecs.length) * 100);
      } else {
        pct = 100; // Default if no class recorded
      }
      return { label: w.label, pct };
    });

    // 2. Assignment Score History
    const assignments = batchName ? await Assignment.find({ batch: batchName }) : [];
    const assignmentScores = assignments.map(a => {
      const sub = a.submissions.find(s => String(s.student) === String(studentId) && s.status === 'graded');
      return {
        title: a.title,
        score: sub ? sub.marks : 0,
        totalMarks: a.totalMarks
      };
    });

    // 3. Average Test Score per subject
    const progressList = await Progress.find({ student: studentId });
    const avgTestScores = progressList.map(p => ({
      subject: p.subject,
      score: p.overallScore
    }));

    // 4. Fee Payment Status
    const fee = await Fee.findOne({ student: studentId });
    let totalBilled = 0;
    let paidAmount = 0;
    let outstandingAmount = 0;
    let nextInstallmentDate = null;

    if (fee) {
      totalBilled = fee.totalAmount - (fee.discount || 0);
      paidAmount = fee.paidAmount;
      outstandingAmount = Math.max(0, totalBilled - paidAmount);

      if (fee.installments && fee.installments.length > 0) {
        const unpaid = fee.installments.find(inst => (inst.amount - (inst.paidAmount || 0)) > 0);
        if (unpaid) {
          nextInstallmentDate = unpaid.dueDate;
        }
      } else {
        nextInstallmentDate = fee.dueDate;
      }
    }

    // 5. Curriculum Completion % per subject
    const curriculums = batchName ? await Curriculum.find({ batch: batchName }) : [];
    const curriculumCompletion = curriculums.map(c => ({
      subject: c.subject,
      pct: c.completionPct
    }));

    res.render('student/analytics', {
      title: 'My Analytics Dashboard',
      user: req.user,
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
    logger.error('Student Analytics Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};
