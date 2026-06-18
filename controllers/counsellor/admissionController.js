const User = require('../../models/User');
const Lead = require('../../models/Lead');
const Fee = require('../../models/Fee');
const Student = require('../../models/Student');
const Message = require('../../models/Message');
const logger = require('../../utils/logger');

function buildTeacherOptions(teacherProfiles) {
  return teacherProfiles
    .filter(p => p.user && p.user.status === 'active')
    .map(p => ({
      _id: p._id,
      userId: p.user._id,
      name: p.user.name,
      courses: p.courses
    }));
}

function attachTeacherProfileIdsToBatches(batches, teacherProfiles) {
  const profileByUserId = new Map(
    teacherProfiles
      .filter(p => p.user)
      .map(p => [p.user._id.toString(), p._id.toString()])
  );

  return batches.map(batch => {
    const obj = batch.toObject ? batch.toObject() : batch;
    obj.teacherProfileIds = (obj.teachers || [])
      .map(id => profileByUserId.get(id.toString()))
      .filter(Boolean);
    return obj;
  });
}

/**
 * GET /counsellor/students
 * Lists ALL students assigned to this counsellor (via Student.counsellor field).
 */
exports.getMyStudents = async (req, res) => {
  const { search } = req.query;
  try {
    const counsellorId = req.user.counsellorProfileId;

    let students = await Student.find({ counsellor: counsellorId })
      .populate('user', 'name email phone status isActive profilePic')
      .populate('course', 'name')
      .populate('batch', 'name')
      .sort({ createdAt: -1 });

    // Filter out students whose user doc has been deleted
    students = students.filter(s => s.user);

    if (search) {
      const searchLower = search.toLowerCase().trim();
      students = students.filter(s =>
        s.user.name.toLowerCase().includes(searchLower) ||
        (s.user.phone && s.user.phone.includes(searchLower)) ||
        (s.user.email && s.user.email.toLowerCase().includes(searchLower))
      );
    }

    // Fetch fee records for all these students
    const studentIds = students.map(s => s._id);
    const fees = studentIds.length > 0 ? await Fee.find({ student: { $in: studentIds } }) : [];

    const studentData = students.map(s => {
      const fee = fees.find(f => String(f.student) === String(s._id));
      let feeStatus = 'unpaid';
      let feePct = 0;
      if (fee) {
        const net = (fee.totalAmount || 0) - (fee.discount || 0);
        const due = Math.max(0, net - (fee.paidAmount || 0));
        feePct = net > 0 ? Math.round((fee.paidAmount / net) * 100) : 0;
        if (net > 0) {
          if (due === 0) feeStatus = 'paid';
          else if (fee.paidAmount > 0) feeStatus = 'partial';
        }
        if (due > 0 && fee.dueDate && new Date(fee.dueDate) < new Date()) {
          feeStatus = 'overdue';
        }
      }
      return {
        _id: s._id,
        rollNumber: s.rollNumber,
        name: s.user.name,
        email: s.user.email,
        phone: s.user.phone || '—',
        profilePic: s.user.profilePic,
        course: s.course ? s.course.name : '—',
        batch: s.batch ? s.batch.name : '—',
        enrollmentDate: s.enrollmentDate,
        status: s.user.status || (s.user.isActive ? 'active' : 'inactive'),
        fees_total: s.fees_total,
        fees_paid: s.fees_paid,
        feeStatus,
        feePct
      };
    });

    // Course-wise counts
    const courseMap = {};
    studentData.forEach(s => {
      courseMap[s.course] = (courseMap[s.course] || 0) + 1;
    });

    const activeCount = studentData.filter(s => s.status === 'active').length;

    res.render('counsellor/students', {
      title: 'My Students',
      user: req.user,
      students: studentData,
      activeCount,
      courseMap,
      filter: req.query
    });
  } catch (err) {
    logger.error('Counsellor getMyStudents Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

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
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user.counsellorProfileId }).populate('interestedCourse');
    if (!lead) {
      logger.warn('Counsellor unauthorized lead convert request', { leadId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }

    const Batch = require('../../models/Batch');
    const batches = await Batch.find({ isActive: true }).populate('course');
    
    const Teacher = require('../../models/Teacher');
    const teacherProfiles = await Teacher.find().populate('user');
    const teachers = buildTeacherOptions(teacherProfiles);
    const batchesForForm = attachTeacherProfileIdsToBatches(batches, teacherProfiles);

    res.render('counsellor/convert', {
      title: `Convert: ${lead.name}`,
      user: req.user,
      lead,
      batches: batchesForForm,
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
  const batches = await Batch.find({ isActive: true }).populate('course');
  
  const Teacher = require('../../models/Teacher');
  const teacherProfiles = await Teacher.find().populate('user');
  const teachers = buildTeacherOptions(teacherProfiles);
  const batchesForForm = attachTeacherProfileIdsToBatches(batches, teacherProfiles);
  let lead;

  try {
    lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user.counsellorProfileId }).populate('interestedCourse');
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
        batches: batchesForForm,
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
        batches: batchesForForm,
        teachers,
        error: 'A valid email address is required.'
      });
    }

    if (!password || password.length < 8) {
      return res.render('counsellor/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches: batchesForForm,
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
        batches: batchesForForm,
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
        batches: batchesForForm,
        teachers,
        error: 'Batch selection or a custom batch name is required.'
      });
    }

    const Course = require('../../models/Course');
    const Student = require('../../models/Student');

    const courseName = req.body.course || (lead.interestedCourse ? lead.interestedCourse.name : '') || 'Digital Marketing';
    let courseDoc = await Course.findOne({
      $or: [
        { name: courseName },
        { code: courseName.toUpperCase() }
      ]
    });
    if (!courseDoc) {
      courseDoc = await Course.findOne();
    }

    const selectedTeacherProfile = req.body.teacherId
      ? teacherProfiles.find(profile => profile._id.toString() === req.body.teacherId)
      : null;
    const selectedTeacherUserId = selectedTeacherProfile?.user?._id || null;

    // Dynamic Batch creation if it doesn't exist yet
    let targetBatchObj = await Batch.findOne({ name: batchName });
    if (!targetBatchObj) {
      targetBatchObj = await Batch.create({
        name: batchName,
        course: courseDoc ? courseDoc._id : null,
        capacity: 20,
        teachers: selectedTeacherUserId ? [selectedTeacherUserId] : [],
        isActive: true
      });
      logger.info('Dynamically created missing batch during counsellor lead conversion', { batchName });
    } else if (selectedTeacherUserId && !targetBatchObj.teachers.some(id => id.toString() === selectedTeacherUserId.toString())) {
      targetBatchObj.teachers.push(selectedTeacherUserId);
      await targetBatchObj.save();
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
        status: 'active',
        mustChangePassword: true,
        passwordSetByAdmin: true,
        firstLoginCompleted: false
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
        batches: batchesForForm,
        teachers,
        error: cleanErrMessage
      });
    }
    res.redirect('/counsellor/leads?error=1');
  }
};
