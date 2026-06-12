const Lead = require('../../models/Lead');
const User = require('../../models/User');
const Fee = require('../../models/Fee');
const Attendance = require('../../models/Attendance');
const Assignment = require('../../models/Assignment');
const logger = require('../../utils/logger');

exports.getReports = async (req, res) => {
  try {
    const counsellorId = req.user._id;

    // 1. Fetch leads metrics
    const [totalLeads, convertedLeads] = await Promise.all([
      Lead.countDocuments({ assignedTo: counsellorId }),
      Lead.find({ assignedTo: counsellorId, status: 'admission_completed' })
    ]);

    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads.length / totalLeads) * 100) : 0;

    let avgDays = 0;
    if (convertedLeads.length > 0) {
      const sumDays = convertedLeads.reduce((acc, l) => {
        const convDate = l.convertedAt || l.updatedAt;
        const diff = new Date(convDate) - new Date(l.createdAt);
        return acc + Math.max(0, diff / (1000 * 60 * 60 * 24));
      }, 0);
      avgDays = Math.round(sumDays / convertedLeads.length);
    }

    // 2. Fetch admitted students (health grid)
    const students = await User.find({ role: 'student', counsellor: counsellorId }).sort({ name: 1 });

    const studentHealthGrid = [];
    for (const student of students) {
      const [attList, fee, assignments] = await Promise.all([
        Attendance.find({ student: student._id }),
        Fee.findOne({ student: student._id }),
        student.batch ? Assignment.find({ batch: student.batch }) : []
      ]);

      // Attendance %
      let attendancePct = 100;
      if (attList.length > 0) {
        const presentCount = attList.filter(a => ['present', 'late'].includes(a.status)).length;
        attendancePct = Math.round((presentCount / attList.length) * 100);
      }

      // Fee status: paid / partial / overdue
      let feeStatus = 'paid';
      let outstanding = 0;
      if (fee) {
        outstanding = Math.max(0, fee.totalAmount - (fee.discount || 0) - fee.paidAmount);
        if (outstanding > 0) {
          // Check if any installment is overdue
          const now = new Date();
          let hasOverdueInstallment = false;
          if (fee.installments && fee.installments.length > 0) {
            hasOverdueInstallment = fee.installments.some(inst => {
              const instOutstanding = inst.amount - (inst.paidAmount || 0);
              return instOutstanding > 0 && inst.dueDate && new Date(inst.dueDate) < now;
            });
          } else if (fee.dueDate && new Date(fee.dueDate) < now) {
            hasOverdueInstallment = true;
          }
          feeStatus = hasOverdueInstallment ? 'overdue' : 'partial';
        }
      }

      // Assignment Submission Rate %
      let submissionRate = 100;
      if (assignments.length > 0) {
        const submitted = assignments.filter(a =>
          a.submissions.some(sub => String(sub.student) === String(student._id))
        ).length;
        submissionRate = Math.round((submitted / assignments.length) * 100);
      }

      studentHealthGrid.push({
        student,
        attendancePct,
        feeStatus,
        outstanding,
        submissionRate
      });
    }

    res.render('counsellor/reports', {
      title: 'My Reports & Analytics',
      user: req.user,
      totalLeads,
      conversionRate,
      avgDays,
      studentHealthGrid,
      page: 'reports'
    });
  } catch (err) {
    logger.error('Counsellor Reports Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};
