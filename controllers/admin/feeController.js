const User = require('../../models/User');
const Fee = require('../../models/Fee');
const { todayIST } = require('../../utils/dateHelper');
const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');

/**
 * GET /admin/fees
 * Admin only. Retrieves all fee records, calculates dynamic fields (dueAmount, paymentStatus, isOverdue),
 * and handles sorting and status filtering.
 */
exports.getFees = async (req, res) => {
  try {
    const { search, paymentStatus, sortBy } = req.query;
    const filter = {};

    if (search) {
      const matchingStudents = await User.find({
        role: 'student',
        name: { $regex: escapeRegex(search), $options: 'i' }
      }).select('_id');
      const studentIds = matchingStudents.map(s => s._id);
      filter.student = { $in: studentIds };
    }

    let fees = await Fee.find(filter)
      .populate('student', 'name course batch phone');

    const now = new Date();
    fees = fees.map(f => {
      const dueAmount = Math.max(0, f.totalAmount - (f.discount || 0) - f.paidAmount);
      let status = 'no invoice';
      if (f.totalAmount > 0) {
        if (dueAmount === 0) {
          status = 'fully paid';
        } else if (f.paidAmount > 0) {
          status = 'partially paid';
        } else {
          status = 'unpaid';
        }
      }
      const isOverdue = dueAmount > 0 && f.dueDate && new Date(f.dueDate) < now;
      
      const obj = f.toObject();
      obj.dueAmount = dueAmount;
      obj.isOverdue = isOverdue;
      obj.paymentStatus = isOverdue ? 'overdue' : status;
      return obj;
    });

    if (paymentStatus) {
      fees = fees.filter(f => f.paymentStatus === paymentStatus);
    }

    if (sortBy === 'outstanding') {
      fees.sort((a, b) => b.dueAmount - a.dueAmount);
    } else if (sortBy === 'longest_overdue') {
      fees.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } else {
      fees.sort((a, b) => b.createdAt - a.createdAt);
    }

    res.render('admin/fees', {
      title: 'Fee Management',
      user: req.user,
      fees,
      filter: req.query
    });
  } catch (err) {
    logger.error('getFees Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/fees/:studentId
 * Admin only. Renders the detailed fee ledger for a specific student.
 */
exports.getStudentFee = async (req, res) => {
  try {
    const fee = await Fee.findOne({ student: req.params.studentId })
      .populate('student', 'name course batch phone email')
      .populate('payments.receivedBy', 'name');
    if (!fee) return res.redirect('/admin/fees');
    res.render('admin/fee-detail', { title: 'Fee Details', user: req.user, fee });
  } catch (err) {
    logger.error('getStudentFee Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /admin/fees/:studentId/payment
 * Admin only. Records a new payment inside the student\'s fee ledger.
 */
exports.postAddPayment = async (req, res) => {
  const { amount, method, transactionId, note } = req.body;
  logger.info('Add payment request received', { studentId: req.params.studentId, amount: Number(amount), method, transactionId });
  try {
    const fee = await Fee.findOne({ student: req.params.studentId });
    if (!fee) return res.redirect('/admin/fees');

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.redirect(`/admin/fees/${req.params.studentId}?error=Invalid+amount`);
    }
    if (amt > (fee.totalAmount - fee.paidAmount + 1)) {
      return res.redirect(`/admin/fees/${req.params.studentId}?error=Amount+exceeds+balance`);
    }

    fee.payments.push({ amount: amt, method, transactionId, note, receivedBy: req.user._id });
    await fee.save();

    await User.findByIdAndUpdate(req.params.studentId, { fees_paid: fee.paidAmount });
    logger.info('Payment recorded successfully', { studentId: req.params.studentId, paidAmount: fee.paidAmount });
    res.redirect(`/admin/fees/${req.params.studentId}?paid=1`);
  } catch (err) {
    logger.error('Add Payment Error', { err: err.message });
    res.redirect(`/admin/fees/${req.params.studentId}?error=1`);
  }
};

/**
 * POST /admin/fees/:studentId/update
 * Admin only. Modifies top-level invoice stats (totalAmount, discount) and triggers auto-installments recalculation.
 */
exports.postUpdateFee = async (req, res) => {
  try {
    const { totalAmount, discount, discountReason } = req.body;
    const fee = await Fee.findOne({ student: req.params.studentId });
    if (!fee) return res.redirect('/admin/fees');

    fee.totalAmount = Number(totalAmount) || 0;
    fee.discount = Number(discount) || 0;
    fee.discountReason = discountReason || '';
    
    fee.installments = [];
    await fee.save();

    await User.findByIdAndUpdate(req.params.studentId, { fees_total: fee.totalAmount });
    logger.info('Fee ledger updated successfully', { studentId: req.params.studentId, totalAmount: fee.totalAmount });
    res.redirect(`/admin/fees/${req.params.studentId}?updated=1`);
  } catch (err) {
    logger.error('Update Fee Error', { err: err.message });
    res.redirect(`/admin/fees/${req.params.studentId}?error=1`);
  }
};
