const Student = require('../../models/Student');
const Fee = require('../../models/Fee');
const Message = require('../../models/Message');

const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');
const buildFeeSchedule = require('../../utils/feeSchedule');
const getFeeStatus = require('../../utils/feeStatus');
const { createFeeInvoice, invoiceNumber } = require('../../utils/feeInvoicePdf');
const { PAYMENT_METHODS } = require('../../config/constants');


// GET /admin/fees
exports.getFees = async (req, res) => {
  try {
    const { search, paymentStatus, sortBy, aging, course } = req.query;

    const filter = {};
    if (/^[a-f\d]{24}$/i.test(course || '')) filter.course = course;

    if (search) {
      const matchingStudents = await Student.find()
        .populate({
          path: 'user',
          match: {
            name: {
              $regex: escapeRegex(search),
              $options: 'i'
            }
          },
          select: 'name phone email'
        })
        .select('_id user');

      const studentIds = matchingStudents
        .filter(student => student.user)
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
            path: 'user',
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
      if (obj.student && obj.student.user) {
        obj.student.name = obj.student.user.name;
        obj.student.phone = obj.student.user.phone;
        obj.student.email = obj.student.user.email;
      } else if (obj.student) {
        obj.student.name = obj.student.name || 'Unknown Student';
        obj.student.phone = obj.student.phone || '—';
        obj.student.email = obj.student.email || '—';
      }
      if (obj.student && obj.student.batch) {
        obj.student.batch = (obj.student.batch && obj.student.batch.name) ? obj.student.batch.name : '—';
      }
      if (obj.course) {
        obj.course = (obj.course && obj.course.name) ? obj.course.name : '—';
      }
      if (obj.batch) {
        obj.batch = (obj.batch && obj.batch.name) ? obj.batch.name : '—';
      }

      Object.assign(obj, getFeeStatus(fee, now));

      return obj;
    });

    const feeStats = fees.reduce((stats, fee) => {
      stats[fee.paymentStatus] = (stats[fee.paymentStatus] || 0) + 1;
      return stats;
    }, { completed: 0, partially_paid: 0, overdue: 0, unpaid: 0 });

    if (paymentStatus) {
      fees = fees.filter(fee => fee.paymentStatus === paymentStatus);
    }
    if (['current', '1_30', '31_60', '61_90', '91_plus'].includes(aging)) {
      fees = fees.filter(fee => {
        const dues = fee.installments?.length
          ? fee.installments.filter(item => Math.max(0, item.amount - item.paidAmount) > 0).map(item => item.dueDate)
          : (fee.dueAmount > 0 ? [fee.dueDate] : []);
        return dues.some(dueDate => {
          if (!dueDate || new Date(dueDate) >= now) return aging === 'current';
          const days = Math.ceil((now - new Date(dueDate)) / 86400000);
          if (aging === '1_30') return days <= 30;
          if (aging === '31_60') return days > 30 && days <= 60;
          if (aging === '61_90') return days > 60 && days <= 90;
          return aging === '91_plus' && days > 90;
        });
      });
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
      feeStats,
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
            path: 'user',
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
      const student = await Student.findById(req.params.studentId)
        .populate('user', 'name phone email status')
        .populate('course', 'name code durationMonths fees')
        .populate('batch', 'name');
      if (!student) return res.redirect('/admin/students');

      return res.render('admin/fee-setup', {
        title: 'Set Up Fee Invoice',
        user: req.user,
        student
      });
    }

    const feeObj = fee.toObject();
    if (feeObj.student && feeObj.student.user) {
      feeObj.student.name = feeObj.student.user.name;
      feeObj.student.phone = feeObj.student.user.phone;
      feeObj.student.email = feeObj.student.user.email;
    } else if (feeObj.student) {
      feeObj.student.name = feeObj.student.name || 'Unknown Student';
      feeObj.student.phone = feeObj.student.phone || '—';
      feeObj.student.email = feeObj.student.email || '—';
    }
    if (feeObj.student && feeObj.student.batch) {
      feeObj.student.batch = (feeObj.student.batch && feeObj.student.batch.name) ? feeObj.student.batch.name : '—';
    }
    if (feeObj.course) {
      feeObj.course = (feeObj.course && feeObj.course.name) ? feeObj.course.name : '—';
    }
    if (feeObj.batch) {
      feeObj.batch = (feeObj.batch && feeObj.batch.name) ? feeObj.batch.name : '—';
    }

    res.render('admin/fee-detail', {
      title: 'Fee Details',
      user: req.user,
      fee: feeObj
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

exports.getFeeInvoice = async (req, res, next) => {
  try {
    const fee = await Fee.findOne({ student: req.params.studentId })
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name phone email' },
          { path: 'course', select: 'name' }
        ]
      })
      .populate('course', 'name');
    if (!fee || !fee.student) return res.redirect(`/admin/fees/${req.params.studentId}`);

    const studentSlug = String(fee.student.user?.name || 'student').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'student';
    const filename = `${invoiceNumber(fee)}-${studentSlug}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const pdf = createFeeInvoice(fee);
    pdf.on('error', next);
    pdf.pipe(res);
    pdf.end();
  } catch (err) {
    next(err);
  }
};

// POST /admin/fees/:studentId/setup
exports.postSetupFee = async (req, res) => {
  try {
    const existing = await Fee.findOne({ student: req.params.studentId }).select('_id');
    if (existing) return res.redirect(`/admin/fees/${req.params.studentId}`);

    const student = await Student.findById(req.params.studentId).populate('course', 'durationMonths');
    if (!student || !student.course) return res.redirect(`/admin/students/${req.params.studentId}?error=1`);

    const totalAmount = Number(req.body.totalAmount);
    const discount = Number(req.body.discount || 0);
    const paidAmount = Number(req.body.paidAmount || 0);
    const netTotal = totalAmount - discount;
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(discount) || discount < 0 || discount > totalAmount || !Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > netTotal) {
      return res.redirect(`/admin/fees/${req.params.studentId}?invalid_fee_plan=1`);
    }

    const paymentMethods = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Other'];
    const method = paymentMethods.includes(req.body.method) ? req.body.method : 'Cash';
    let installments;
    try {
      installments = buildFeeSchedule(req.body, netTotal);
    } catch (validationError) {
      logger.warn('Invalid initial EMI schedule rejected', { studentId: req.params.studentId, error: validationError.message });
      return res.redirect(`/admin/fees/${req.params.studentId}?invalid_fee_plan=1`);
    }
    const enrollmentDate = new Date(student.enrollmentDate || Date.now()).toISOString().slice(0, 10);
    if (!installments.length || installments.some(item => item.dueDate.toISOString().slice(0, 10) < enrollmentDate)) {
      return res.redirect(`/admin/fees/${req.params.studentId}?invalid_fee_plan=1`);
    }
    const fee = new Fee({
      student: student._id,
      course: student.course._id,
      batch: student.batch || null,
      totalAmount,
      discount,
      discountReason: String(req.body.discountReason || '').trim().slice(0, 200),
      paidAmount,
      dueDate: student.enrollmentDate || new Date(),
      courseDurationMonths: student.course.durationMonths || 3,
      installments,
      payments: paidAmount ? [{ amount: paidAmount, method, note: 'Opening payment', receivedBy: req.user._id, paidAt: new Date() }] : []
    });
    await fee.save();
    await Student.findByIdAndUpdate(student._id, { fees_total: fee.totalAmount, fees_paid: fee.paidAmount });

    res.redirect(`/admin/fees/${student._id}?created=1`);
  } catch (err) {
    if (err.code === 11000) return res.redirect(`/admin/fees/${req.params.studentId}`);
    logger.error('Fee setup failed', { error: err.message, studentId: req.params.studentId, adminId: req.user._id });
    res.redirect(`/admin/fees/${req.params.studentId}?error=1`);
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

    const student = await Student.findById(req.params.studentId).populate('user', '_id status');
    if (student?.user && student.user.status === 'active') {
      await Message.create({
        sender: req.user._id,
        recipient: student.user._id,
        content: `Payment received: Rs. ${amt.toLocaleString('en-IN')} has been added to your fee ledger.`
      }).catch(notificationErr => {
        logger.warn('Payment saved but student notification failed', {
          studentId: req.params.studentId,
          error: notificationErr.message
        });
      });
    }

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

// POST /admin/fees/bulk-complete
exports.postBulkComplete = async (req, res) => {
  try {
    const submitted = Array.isArray(req.body.feeIds) ? req.body.feeIds : [req.body.feeIds];
    const feeIds = [...new Set(submitted.filter(id => /^[0-9a-fA-F]{24}$/.test(String(id || ''))))].slice(0, 500);
    const method = PAYMENT_METHODS.includes(req.body.method) ? req.body.method : 'Cash';
    if (!feeIds.length) return res.redirect('/admin/fees?error=Select+at+least+one+fee+ledger');

    const fees = await Fee.find({ _id: { $in: feeIds } });
    let completed = 0;
    for (const fee of fees) {
      const due = Math.max(0, fee.totalAmount - (fee.discount || 0) - fee.paidAmount);
      if (due <= 0) continue;
      fee.payments.push({
        amount: due,
        method,
        note: 'Bulk fee completion',
        receivedBy: req.user._id,
        paidAt: new Date()
      });
      await fee.save();
      await Student.findByIdAndUpdate(fee.student, { fees_total: fee.totalAmount, fees_paid: fee.paidAmount });
      completed += 1;
    }
    return res.redirect(`/admin/fees?completed=${completed}`);
  } catch (err) {
    logger.error('Bulk Fee Completion Error', { err: err.message });
    return res.redirect('/admin/fees?error=Unable+to+complete+selected+fees');
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

    const nextTotal = Number(totalAmount);
    const nextDiscount = Number(discount || 0);
    if (!Number.isFinite(nextTotal) || nextTotal <= 0 || !Number.isFinite(nextDiscount) || nextDiscount < 0 || nextDiscount > nextTotal) {
      return res.redirect(`/admin/fees/${req.params.studentId}?invalid_fee_plan=1`);
    }

    const netTotal = nextTotal - nextDiscount;
    if (netTotal + 0.01 < fee.paidAmount) {
      return res.redirect(`/admin/fees/${req.params.studentId}?fee_below_paid=1`);
    }

    fee.totalAmount = nextTotal;
    fee.discount = nextDiscount;
    fee.discountReason = discountReason || '';
    try {
      fee.installments = buildFeeSchedule(req.body, netTotal);
    } catch (validationError) {
      logger.warn('Invalid fee schedule rejected', { studentId: req.params.studentId, error: validationError.message });
      return res.redirect(`/admin/fees/${req.params.studentId}?invalid_fee_plan=1`);
    }

    await fee.save();

    await Student.findByIdAndUpdate(req.params.studentId, {
      fees_total: fee.totalAmount,
      fees_paid: fee.paidAmount
    });

    const student = await Student.findById(req.params.studentId).populate('user', '_id status');
    if (student?.user && student.user.status === 'active') {
      await Message.create({
        sender: req.user._id,
        recipient: student.user._id,
        content: 'Your fee ledger has been updated. Please review your latest installments and due dates.'
      }).catch(notificationErr => {
        logger.warn('Fee ledger saved but student notification failed', {
          studentId: req.params.studentId,
          error: notificationErr.message
        });
      });
    }

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
