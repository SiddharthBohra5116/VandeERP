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

    // Fetch distinct active batches from students roster
    const batches = await User.distinct('batch', { role: 'student', isActive: true });
    
    // Add default batches if none exist
    if (batches.length === 0) {
      batches.push('Morning Batch', 'Afternoon Batch', 'Evening Batch');
    }

    res.render('admin/convert', {
      title: `Convert: ${lead.name}`,
      user: req.user,
      lead,
      batches
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
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.redirect('/admin/leads');

    const batches = await User.distinct('batch', { role: 'student', isActive: true });
    if (batches.length === 0) {
      batches.push('Morning Batch', 'Afternoon Batch', 'Evening Batch');
    }

    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password ? req.body.password.trim() : '';

    if (!email || !email.includes('@')) {
      return res.redirect(`/admin/leads?error=${encodeURIComponent('A valid student email address is required.')}`);
    }

    if (!password || password.length < 8) {
      return res.redirect(`/admin/leads?error=${encodeURIComponent('Password must be at least 8 characters long.')}`);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.redirect(`/admin/leads?error=${encodeURIComponent('This email address is already registered.')}`);
    }

    const totalFees = Number(req.body.fees_total) || 0;
    const paidFees = Number(req.body.fees_paid) || 0;
    const minDownPayment = totalFees * 0.5;
    let discountReason = '';
    if (paidFees < minDownPayment) {
      discountReason = 'Admin bypassed 50% down payment requirement';
    }

    const batchName = (req.body.batch && req.body.batch.trim()) ? req.body.batch.trim() : 'General Batch';
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
      enrollmentDate: enrollDate,
      fees_total: totalFees,
      fees_paid: paidFees,
    });

    const feeLedger = new Fee({
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

    feeLedger.generateInstallments();
    feeLedger.allocatePayments();
    await feeLedger.save();

    lead.status = 'converted';
    lead.convertedStudent = student._id;
    lead.convertedAt = new Date();
    await lead.save();

    logger.info('Lead converted to student successfully', { leadId: req.params.id, studentId: student._id });
    res.redirect(`/admin/users?converted=1`);
  } catch (err) {
    logger.error('Convert Lead Error', { err: err.message });
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

    logger.info('Admin Lead Comment posted successfully', { leadId: req.params.id });
    res.redirect(`/admin/leads/${req.params.id}?updated=1`);
  } catch (err) {
    logger.error('Admin Add Lead Comment Error', { err: err.message });
    res.redirect(`/admin/leads/${req.params.id}?error=1`);
  }
};
