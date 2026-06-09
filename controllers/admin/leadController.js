const User = require('../../models/User');
const Lead = require('../../models/Lead');
const Fee = require('../../models/Fee');
const { escapeRegex } = require('../../utils/sanitize');
const { computeSourceStats } = require('../../utils/leadAnalytics');
const logger = require('../../utils/logger');

/**
 * GET /admin/leads
 * Admin only. Retrieves leads with filtering (status, course, source, search)
 * and generates global source quality stats.
 */
exports.getLeads = async (req, res) => {
  try {
    const { status, course, source, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (course) filter.course = course;
    if (source) filter.source = source;
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } }
      ];
    }

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    const counsellors = await User.find({ role: 'counsellor', isActive: true }).select('name');

    // Global Lead Source Quality Analytics via DRY utility helper
    const allLeadsAnalytics = await Lead.find({});
    const sourceStatsMap = computeSourceStats(allLeadsAnalytics);

    res.render('admin/leads', { 
      title: 'Leads', 
      user: req.user, 
      leads, 
      counsellors, 
      sourceStats: sourceStatsMap,
      filter: req.query 
    });
  } catch (err) {
    logger.error('getLeads Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/leads/:id
 * Admin only. Displays lead detailed details, follow-up history, and timeline.
 */
exports.getLeadDetail = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name email phone')
      .populate('followUpHistory.doneBy', 'name role')
      .populate('convertedStudent', 'name');

    if (!lead) return res.redirect('/admin/leads');

    const counsellors = await User.find({ role: 'counsellor', isActive: true }).select('name');
    res.render('admin/lead-detail', { title: lead.name, user: req.user, lead, counsellors, error: req.query.error });
  } catch (err) {
    logger.error('Admin Lead Details Fetch Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /admin/leads/:id/assign
 * Admin only. Assigns a lead to a counsellor.
 */
exports.postAssignLead = async (req, res) => {
  try {
    const assignedTo = req.body.counsellorId ? req.body.counsellorId : null;
    await Lead.findByIdAndUpdate(req.params.id, { assignedTo });
    logger.info('Lead assigned successfully', { leadId: req.params.id, counsellorId: assignedTo });
    const redirectUrl = req.header('Referer') || '/admin/leads';
    res.redirect(redirectUrl);
  } catch (err) {
    logger.error('postAssignLead Error', { err: err.message });
    const redirectUrl = req.header('Referer') || '/admin/leads';
    const cleanUrl = redirectUrl.split('?')[0];
    res.redirect(`${cleanUrl}?error=${encodeURIComponent(err.message)}`);
  }
};

/**
 * GET /admin/leads/:id/convert
 * Admin only. Renders the lead conversion page with auto-populated details and batch lists.
 */
exports.getConvertLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.redirect('/admin/leads');

    const Batch = require('../../models/Batch');
    const batches = await Batch.find({ isActive: true }).distinct('name');

    // Fetch active teachers
    const teachers = await User.find({ role: 'teacher', isActive: true }).select('name');

    res.render('admin/convert', {
      title: `Convert: ${lead.name}`,
      user: req.user,
      lead,
      batches,
      teachers
    });
  } catch (err) {
    logger.error('Admin Get Convert Lead Error', { err: err.message });
    res.redirect(`/admin/leads/${req.params.id}?error=1`);
  }
};

/**
 * POST /admin/leads/:id/convert
 * Admin only. Converts a lead into a registered student, creates their fee ledger with explicit installments,
 * and updates their status to converted.
 */
exports.postConvertLead = async (req, res) => {
  logger.info('Convert lead request received', { leadId: req.params.id });
  const Batch = require('../../models/Batch');
  const batches = await Batch.find({ isActive: true }).distinct('name');
  const teachers = await User.find({ role: 'teacher', isActive: true }).select('name');
  let lead;

  try {
    lead = await Lead.findById(req.params.id);
    if (!lead) return res.redirect('/admin/leads');

    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password ? req.body.password.trim() : '';

    if (!email || !email.includes('@')) {
      return res.render('admin/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        teachers,
        error: 'A valid student email address is required.'
      });
    }

    if (!password || password.length < 8) {
      return res.render('admin/convert', {
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
      return res.render('admin/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        teachers,
        error: 'This email address is already registered.'
      });
    }

    const totalFees = Number(req.body.fees_total) || 0;
    const paidFees = Number(req.body.fees_paid) || 0;
    const minDownPayment = totalFees * 0.5;
    let discountReason = '';
    if (paidFees < minDownPayment) {
      discountReason = 'Admin bypassed 50% down payment requirement';
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
      return res.render('admin/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        teachers,
        error: 'Batch selection or a custom batch name is required.'
      });
    }

    // Dynamic Batch creation if it doesn't exist yet
    let targetBatchObj = await Batch.findOne({ name: batchName });
    if (!targetBatchObj) {
      targetBatchObj = await Batch.create({
        name: batchName,
        course: req.body.course || lead.course || 'Digital Marketing',
        capacity: 20,
        teachers: req.body.teacherId ? [req.body.teacherId] : [],
        isActive: true
      });
      logger.info('Dynamically created missing batch during admin lead conversion', { batchName });
    }
    const enrollDate = req.body.enrollmentDate ? new Date(req.body.enrollmentDate) : new Date();

    const student = await User.create({
      name: req.body.name || lead.name,
      email: email,
      password: password,
      role: 'student',
      phone: req.body.phone || lead.phone,
      course: req.body.course || (lead.course === 'Both' ? 'Both' : lead.course),
      batch: batchName,
      counsellor: lead.assignedTo, 
      teacher: req.body.teacherId || null,
      enrollmentDate: enrollDate,
      fees_total: totalFees,
      fees_paid: paidFees,
      statusHistory: [{
        status: 'active',
        changedBy: req.user._id,
        reason: 'Enrolled via lead conversion'
      }]
    });

    let feeLedger;
    try {
      feeLedger = new Fee({
        student: student._id,
        course: student.course,
        totalAmount: totalFees,
        paidAmount: paidFees,
        discountReason: discountReason,
        payments: paidFees > 0 ? [{
          amount: paidFees,
          method: 'Cash',
          note: 'Admission down payment',
          receivedBy: req.user._id,
          paidAt: new Date()
        }] : []
      });

    // Parse custom installments if provided (support both instName and instName[])
    const instName = req.body.instName || req.body['instName[]'];
    const instAmount = req.body.instAmount || req.body['instAmount[]'];
    const instDueDate = req.body.instDueDate || req.body['instDueDate[]'];

    if (instName && Array.isArray(instName) && instName.length > 0) {
      feeLedger.installments = instName.map((name, i) => ({
        name: name.trim(),
        amount: Number(instAmount[i]) || 0,
        dueDate: instDueDate[i] ? new Date(instDueDate[i]) : new Date(),
        paidAmount: 0
      }));
      // Update general dueDate to the last installment due date
      if (feeLedger.installments.length > 0) {
        feeLedger.dueDate = feeLedger.installments[feeLedger.installments.length - 1].dueDate;
      }
    } else {
      feeLedger.generateInstallments();
    }

      feeLedger.allocatePayments();
      await feeLedger.save();
    } catch (dbErr) {
      await User.findByIdAndDelete(student._id);
      throw dbErr;
    }

    await User.findByIdAndUpdate(student._id, {
      fees_total: feeLedger.totalAmount,
      fees_paid: feeLedger.paidAmount
    });

    lead.status = 'converted';
    lead.convertedStudent = student._id;
    lead.convertedAt = new Date();
    lead.followUpHistory.push({
      note: `Converted to student successfully by admin. Student ID: ${student.rollNumber || student._id}`,
      status: 'converted',
      channel: 'In-person',
      doneBy: req.user._id,
      doneAt: new Date()
    });
    await lead.save();

    logger.info('Lead converted to student successfully', { leadId: req.params.id, studentId: student._id });
    res.redirect(`/admin/students/${student._id}`);
  } catch (err) {
    logger.error('Convert Lead Error', { err: err.message });
    let cleanErrMessage = err.message;
    if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
      cleanErrMessage = 'Database Conflict: A fee ledger index duplicate exists for this student profile.';
    }
    if (lead) {
      return res.render('admin/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        teachers,
        error: cleanErrMessage
      });
    }
    res.redirect('/admin/leads?error=1');
  }
};

/**
 * POST /admin/leads/:id/comment
 * Admin only. Appends a comment/follow-up log to a lead.
 */
exports.postAddLeadComment = async (req, res) => {
  const { note } = req.body;
  logger.info('Admin Lead Comment request received', { leadId: req.params.id, note });
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.redirect('/admin/leads');

    lead.followUpHistory.push({
      note,
      status: lead.status,
      doneBy: req.user._id,
    });
    await lead.save();

    // Send notification to counsellor (Issue 2.9)
    if (lead.assignedTo) {
      const Message = require('../../models/Message');
      await Message.create({
        sender: req.user._id,
        recipient: lead.assignedTo,
        content: `Admin added a note to lead "${lead.name}": "${note.length > 50 ? note.slice(0, 47) + '...' : note}"`
      });
    }

    logger.info('Admin Lead Comment posted successfully', { leadId: req.params.id });
    res.redirect(`/admin/leads/${req.params.id}?updated=1`);
  } catch (err) {
    logger.error('Admin Add Lead Comment Error', { err: err.message });
    res.redirect(`/admin/leads/${req.params.id}?error=1`);
  }
};
