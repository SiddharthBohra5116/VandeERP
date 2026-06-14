const User = require('../../models/User');
const Lead = require('../../models/Lead');
const Fee = require('../../models/Fee');
const Message = require('../../models/Message');
const logger = require('../../utils/logger');

/**
 * GET /counsellor/admissions
 * Retrieves active registered students enrolled by this counsellor.
 */
exports.getAdmissions = async (req, res) => {
  const { search } = req.query;
  try {
    const query = {
      assignedTo: req.user.counsellorProfileId,
      status: 'admission_completed',
      convertedStudent: { $exists: true, $ne: null }
    };
    
    let convertedLeads = await Lead.find(query)
      .populate({
        path: 'convertedStudent',
        populate: [
          { path: 'user', select: 'name email phone status isActive' },
          { path: 'course', select: 'name' },
          { path: 'batch', select: 'name' }
        ]
      })
      .sort({ updatedAt: -1 });

    if (search) {
      const searchLower = search.toLowerCase().trim();
      convertedLeads = convertedLeads.filter(lead => {
        const studentUser = lead.convertedStudent && lead.convertedStudent.user;
        return studentUser && studentUser.name.toLowerCase().includes(searchLower);
      });
    }

    const studentIds = convertedLeads.map(l => l.convertedStudent && l.convertedStudent._id).filter(Boolean);
    const fees = await Fee.find({ student: { $in: studentIds } });

    const students = convertedLeads.map(lead => {
      const sp = lead.convertedStudent;
      const userDoc = sp ? sp.user : null;
      
      const studentObj = sp ? {
        _id: sp._id,
        name: userDoc ? userDoc.name : 'Unknown Student',
        phone: userDoc ? userDoc.phone : '—',
        course: sp.course ? sp.course.name : '—',
        batch: sp.batch ? sp.batch.name : '—',
        fees_total: sp.fees_total,
        fees_paid: sp.fees_paid,
        status: userDoc ? userDoc.status : 'inactive',
        isActive: userDoc ? userDoc.isActive : false
      } : null;

      const fee = sp ? fees.find(f => String(f.student) === String(sp._id)) : null;
      
      let feeStatus = 'unpaid';
      if (fee) {
        const dueAmount = Math.max(0, fee.totalAmount - (fee.discount || 0) - fee.paidAmount);
        if (fee.totalAmount > 0) {
          if (dueAmount === 0) {
            feeStatus = 'paid';
          } else if (fee.paidAmount > 0) {
            feeStatus = 'partial';
          }
        }
        const isOverdue = dueAmount > 0 && fee.dueDate && new Date(fee.dueDate) < new Date();
        if (isOverdue) {
          feeStatus = 'overdue';
        }
      }

      return {
        student: studentObj,
        lead,
        feeStatus,
        fee
      };
    });

    res.render('counsellor/admissions', {
      title: 'Admitted Students',
      user: req.user,
      students,
      filter: req.query,
      filters: req.query
    });
  } catch (err) {
    logger.error('Admissions Fetch Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

/**
 * GET /counsellor/admissions/:id/fee
 * Scoped read-only fee ledger view.
 */
exports.getStudentFee = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student' || String(student.counsellor) !== String(req.user._id)) {
      logger.warn('Unauthorized fee details request by counsellor', { studentId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user, error: 'Unauthorized fee ledger access.' });
    }

    const fee = await Fee.findOne({ student: student._id })
      .populate('student', 'name course batch phone email')
      .populate('payments.receivedBy', 'name');

    if (!fee) return res.redirect('/counsellor/admissions');

    res.render('counsellor/fee-detail', {
      title: `${student.name} — Fee Ledger`,
      user: req.user,
      fee
    });
  } catch (err) {
    logger.error('Counsellor getStudentFee Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

/**
 * GET /counsellor/leads/:id/convert
 * Renders lead conversion form.
 */
exports.getConvertLead = async (req, res) => {
  logger.info('GET convert lead form request', { leadId: req.params.id });
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user.counsellorProfileId });
    if (!lead) {
      logger.warn('Counsellor unauthorized lead convert request', { leadId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }

    const Batch = require('../../models/Batch');
    const batches = await Batch.find({ isActive: true }).distinct('name');
    
    const Teacher = require('../../models/Teacher');
    const teacherProfiles = await Teacher.find().populate('user', 'name status');
    const teachers = teacherProfiles
      .filter(p => p.user && p.user.status === 'active')
      .map(p => ({
        _id: p._id,
        name: p.user.name
      }));

    res.render('counsellor/convert', {
      title: `Convert: ${lead.name}`,
      user: req.user,
      lead,
      batches,
      teachers
    });
  } catch (err) {
    logger.error('Get Convert Lead Error', { error: err.message, stack: err.stack });
    res.redirect(`/counsellor/leads/${req.params.id}?error=1`);
  }
};

/**
 * POST /counsellor/leads/:id/convert
 * Converts a lead into a registered student.
 */
exports.postConvertLead = async (req, res) => {
  logger.info('POST convert lead request received', { leadId: req.params.id });
  
  const Batch = require('../../models/Batch');
  const batches = await Batch.find({ isActive: true }).distinct('name');
  
  const Teacher = require('../../models/Teacher');
  const teacherProfiles = await Teacher.find().populate('user', 'name status');
  const teachers = teacherProfiles
    .filter(p => p.user && p.user.status === 'active')
    .map(p => ({
      _id: p._id,
      name: p.user.name
    }));
  let lead;

  try {
    lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user.counsellorProfileId });
    if (!lead) {
      logger.warn('Counsellor unauthorized lead convert request', { leadId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }

    const totalFees = Number(req.body.fees_total) || 0;
    const paidFees = Number(req.body.fees_paid) || 0;
    const minDownPayment = totalFees * 0.5;

    if (paidFees < minDownPayment) {
      return res.render('counsellor/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        teachers,
        error: `Admission Policy Error: On joining, a minimum 50% down payment (₹${minDownPayment.toLocaleString('en-IN')}) is required. You inputted ₹${paidFees.toLocaleString('en-IN')}.`
      });
    }

    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password ? req.body.password.trim() : '';

    if (!email || !email.includes('@')) {
      return res.render('counsellor/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        teachers,
        error: 'A valid email address is required.'
      });
    }

    if (!password || password.length < 8) {
      return res.render('counsellor/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        teachers,
        error: 'Password must be at least 8 characters long.'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('counsellor/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        teachers,
        error: 'This email address is already registered.'
      });
    }

    let batchName = '';
    if (req.body.customBatch && req.body.customBatch.trim()) {
      batchName = req.body.customBatch.trim();
    } else if (req.body.batch && req.body.batch.trim()) {
      batchName = req.body.batch.trim();
    } else {
      batchName = 'General Batch';
    }

    if (!batchName || batchName.trim() === '') {
      return res.render('counsellor/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        teachers,
        error: 'Batch selection or a custom batch name is required.'
      });
    }

    const Course = require('../../models/Course');
    const Student = require('../../models/Student');

    const courseName = req.body.course || lead.course || 'Digital Marketing';
    let courseDoc = await Course.findOne({
      $or: [
        { name: courseName },
        { code: courseName.toUpperCase() }
      ]
    });
    if (!courseDoc) {
      courseDoc = await Course.findOne();
    }

    // Dynamic Batch creation if it doesn't exist yet
    let targetBatchObj = await Batch.findOne({ name: batchName });
    if (!targetBatchObj) {
      targetBatchObj = await Batch.create({
        name: batchName,
        course: courseDoc ? courseDoc._id : null,
        capacity: 20,
        teachers: req.body.teacherId ? [req.body.teacherId] : [],
        isActive: true
      });
      logger.info('Dynamically created missing batch during counsellor lead conversion', { batchName });
    }

    let studentUser;
    let studentProfile;

    try {
      studentUser = await User.create({
        name: req.body.name || lead.name,
        email: email,
        password: password,
        role: 'student',
        phone: req.body.phone || lead.phone,
        status: 'active'
      });

      studentProfile = await Student.create({
        user: studentUser._id,
        counsellor: req.user.counsellorProfileId,
        teacher: req.body.teacherId || null,
        course: courseDoc ? courseDoc._id : null,
        batch: targetBatchObj ? targetBatchObj._id : null,
        enrollmentDate: req.body.enrollmentDate ? new Date(req.body.enrollmentDate) : new Date(),
        fees_total: totalFees,
        fees_paid: paidFees,
        statusHistory: [{
          status: 'active',
          changedBy: req.user._id,
          reason: 'Enrolled via lead conversion'
        }]
      });

      let feeLedger = new Fee({
        student: studentProfile._id,
        course: courseDoc ? courseDoc._id : null,
        batch: targetBatchObj ? targetBatchObj._id : null,
        totalAmount: totalFees,
        paidAmount: paidFees,
        discount: 0,
        payments: paidFees > 0 ? [{
          amount: paidFees,
          method: 'Cash',
          note: 'Admission down payment',
          receivedBy: req.user._id,
          paidAt: new Date()
        }] : []
      });

      feeLedger.generateInstallments();
      feeLedger.allocatePayments();
      await feeLedger.save();

      await Student.findByIdAndUpdate(studentProfile._id, {
        fees_total: feeLedger.totalAmount,
        fees_paid: feeLedger.paidAmount
      });

      lead.status = 'admission_completed';
      lead.convertedStudent = studentProfile._id;
      lead.convertedAt = new Date();
      lead.followUpHistory.push({
        note: `Lead converted to student by Counsellor. Student ID: ${studentProfile.rollNumber || studentProfile._id}`,
        status: 'admission_completed',
        channel: 'In-person',
        doneBy: req.user._id,
        doneAt: new Date()
      });
      await lead.save();

      logger.info('Lead converted to student successfully by Counsellor', { leadId: lead._id, studentId: studentProfile._id });
      res.redirect('/counsellor/admissions?converted=1');
    } catch (dbErr) {
      if (studentProfile) {
        await Student.findByIdAndDelete(studentProfile._id).catch(() => {});
      }
      if (studentUser) {
        await User.findByIdAndDelete(studentUser._id).catch(() => {});
      }
      throw dbErr;
    }
  } catch (err) {
    logger.error('Post Convert Lead Error', { error: err.message, stack: err.stack });
    
    // Check for duplicate key error (E11000) on Fee collection
    let cleanErrMessage = err.message;
    if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
      cleanErrMessage = 'Database Conflict: A fee ledger index duplicate exists for this student profile.';
    }

    if (lead) {
      return res.render('counsellor/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        teachers,
        error: cleanErrMessage
      });
    }
    res.redirect('/counsellor/leads?error=1');
  }
};
