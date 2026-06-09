const Student = require('../../models/Student');
const Fee = require('../../models/Fee');

const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');


// GET /admin/fees
exports.getFees = async (req, res) => {
  try {
    const { search, paymentStatus, sortBy } = req.query;

    const filter = {};

    if (search) {
      const matchingStudents = await Student.find()
        .populate({
          path: 'userId',
          match: {
            name: {
              $regex: escapeRegex(search),
              $options: 'i'
            }
          },
          select: 'name phone email'
        })
        .select('_id userId');

      const studentIds = matchingStudents
        .filter(student => student.userId)
        .map(student => student._id);

      filter.student = {
        $in: studentIds
      };
    }

    let fees = await Fee.find(filter)
      .populate({
        path: 'student',
        populate: [
          {
            path: 'userId',
            select: 'name phone email status'
          },
          {
            path: 'course',
            select: 'name code'
          },
          {
            path: 'batch',
            select: 'name'
          }
        ]
      })
      .populate('course', 'name code')
      .populate('batch', 'name')
      .populate('payments.receivedBy', 'name')
      .sort({ createdAt: -1 });

    const now = new Date();

    fees = fees.map(fee => {
      const obj = fee.toObject();

      const netAmount =
        fee.totalAmount - (fee.discount || 0);

      const dueAmount =
        Math.max(0, netAmount + fee.totalFine - fee.paidAmount);

      let status = 'no invoice';

      if (fee.totalAmount > 0) {
        if (dueAmount === 0) {
          status = 'fully paid';
        } else if (fee.paidAmount > 0) {
          status = 'partially paid';
        } else {
          status = 'unpaid';
        }
      }

      const isOverdue =
        dueAmount > 0 &&
        fee.dueDate &&
        new Date(fee.dueDate) < now;

      obj.dueAmount = dueAmount;
      obj.isOverdue = isOverdue;
      obj.paymentStatus = isOverdue ? 'overdue' : status;

      return obj;
    });

    if (paymentStatus) {
      fees = fees.filter(fee => fee.paymentStatus === paymentStatus);
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
      fees.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.render('admin/fees', {
      title: 'Fee Management',
      user: req.user,
      fees,
      filter: req.query
    });

  } catch (err) {
    logger.error('getFees Error', {
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


// GET /admin/fees/:studentId
exports.getStudentFee = async (req, res) => {
  try {
    const fee = await Fee.findOne({
      student: req.params.studentId
    })
      .populate({
        path: 'student',
        populate: [
          {
            path: 'userId',
            select: 'name phone email status'
          },
          {
            path: 'course',
            select: 'name code'
          },
          {
            path: 'batch',
            select: 'name'
          }
        ]
      })
      .populate('course', 'name code durationMonths fees')
      .populate('batch', 'name')
      .populate('payments.receivedBy', 'name');

    if (!fee) {
      return res.redirect('/admin/fees');
    }

    res.render('admin/fee-detail', {
      title: 'Fee Details',
      user: req.user,
      fee
    });

  } catch (err) {
    logger.error('getStudentFee Error', {
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


// POST /admin/fees/:studentId/payment
exports.postAddPayment = async (req, res) => {
  const { amount, method, transactionId, note } = req.body;

  try {
    const fee = await Fee.findOne({
      student: req.params.studentId
    });

    if (!fee) {
      return res.redirect('/admin/fees');
    }

    const amt = Number(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      return res.redirect(
        `/admin/fees/${req.params.studentId}?error=Invalid+amount`
      );
    }

    const balance =
      (fee.totalAmount - (fee.discount || 0)) -
      fee.paidAmount;

    if (amt > balance + 1) {
      return res.redirect(
        `/admin/fees/${req.params.studentId}?error=Amount+exceeds+balance`
      );
    }

    fee.payments.push({
      amount: amt,
      method,
      transactionId,
      note,
      receivedBy: req.user._id,
      paidAt: new Date()
    });

    await fee.save();

    await Student.findByIdAndUpdate(req.params.studentId, {
      fees_total: fee.totalAmount,
      fees_paid: fee.paidAmount
    });

    logger.info('Payment recorded successfully', {
      studentId: req.params.studentId,
      paidAmount: fee.paidAmount
    });

    res.redirect(`/admin/fees/${req.params.studentId}?paid=1`);

  } catch (err) {
    logger.error('Add Payment Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect(`/admin/fees/${req.params.studentId}?error=1`);
  }
};


// POST /admin/fees/:studentId/update
exports.postUpdateFee = async (req, res) => {
  try {
    const {
      totalAmount,
      discount,
      discountReason
    } = req.body;

    const fee = await Fee.findOne({
      student: req.params.studentId
    });

    if (!fee) {
      return res.redirect('/admin/fees');
    }

    fee.totalAmount = Number(totalAmount) || 0;
    fee.discount = Number(discount) || 0;
    fee.discountReason = discountReason || '';

    const instName =
      req.body.instName ||
      req.body['instName[]'];

    const instAmount =
      req.body.instAmount ||
      req.body['instAmount[]'];

    const instDueDate =
      req.body.instDueDate ||
      req.body['instDueDate[]'];

    if (
      instName &&
      Array.isArray(instName) &&
      instName.length > 0
    ) {
      fee.installments = instName.map((name, index) => ({
        name: name.trim(),
        amount: Number(instAmount[index]) || 0,
        dueDate: instDueDate[index]
          ? new Date(instDueDate[index])
          : new Date(),
        paidAmount: 0
      }));

      if (fee.installments.length > 0) {
        fee.dueDate =
          fee.installments[fee.installments.length - 1].dueDate;
      }

    } else {
      fee.installments = [];
    }

    await fee.save();

    await Student.findByIdAndUpdate(req.params.studentId, {
      fees_total: fee.totalAmount,
      fees_paid: fee.paidAmount
    });

    logger.info('Fee ledger updated successfully', {
      studentId: req.params.studentId,
      totalAmount: fee.totalAmount
    });

    res.redirect(`/admin/fees/${req.params.studentId}?updated=1`);

  } catch (err) {
    logger.error('Update Fee Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect(`/admin/fees/${req.params.studentId}?error=1`);
  }
};