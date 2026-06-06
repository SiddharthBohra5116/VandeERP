const Lead = require('../models/Lead');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Message = require('../models/Message');
const { escapeRegex } = require('../utils/sanitize');
const safeRedirect = require('../utils/safeRedirect');

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

exports.getDashboard = async (req, res) => {
  try {
    const counsellorId = req.user._id;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch recent leads (limit 10)
    const recentLeads = await Lead.find({ assignedTo: counsellorId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Fetch followups due today or overdue
    const followupLeads = await Lead.find({
      assignedTo: counsellorId,
      followUpDate: { $lt: tomorrow },
      status: { $nin: ['converted', 'lost'] }
    }).sort({ followUpDate: 1 });

    // 1. Task Queue Compilation
    // A. Overdue follow-up leads
    const overdueCallbacks = await Lead.find({
      assignedTo: counsellorId,
      followUpDate: { $lt: today },
      status: { $nin: ['converted', 'lost'] }
    }).sort({ followUpDate: 1 });

    // B. Today's scheduled callbacks
    const todayCallbacks = await Lead.find({
      assignedTo: counsellorId,
      followUpDate: { $gte: today, $lt: tomorrow },
      status: { $nin: ['converted', 'lost'] }
    }).sort({ followUpDate: 1 });

    // C. Overdue student fees (students enrolled by this counsellor)
    const enrolledStudents = await User.find({ role: 'student', counsellor: counsellorId });
    const studentIds = enrolledStudents.map(s => s._id);
    const studentFees = await Fee.find({ student: { $in: studentIds } }).populate('student');
    const feeCallbacks = studentFees.filter(f => f.student && f.dueAmount > 0 && f.dueDate && new Date(f.dueDate) < today);

    // 2. Lead Source Quality Analytics Compilation
    const allLeads = await Lead.find({ assignedTo: counsellorId });
    const { computeSourceStats } = require('../utils/leadAnalytics');
    const sourceStatsMap = computeSourceStats(allLeads);

    // Aggregations for status breakdown
    const statusStats = await Lead.aggregate([
      { $match: { assignedTo: counsellorId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Aggregations for source breakdown
    const sourceStats = await Lead.aggregate([
      { $match: { assignedTo: counsellorId } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    // Total leads count
    const total = await Lead.countDocuments({ assignedTo: counsellorId });

    // New leads today
    const newToday = await Lead.countDocuments({
      assignedTo: counsellorId,
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Follow-ups due count
    const followupsDue = followupLeads.length;

    // Converted count
    const converted = await Lead.countDocuments({
      assignedTo: counsellorId,
      status: 'converted'
    });

    // Lost count
    const lost = await Lead.countDocuments({
      assignedTo: counsellorId,
      status: 'lost'
    });

    // Map aggregations to maps
    const byStatus = {
      new: 0,
      contacted: 0,
      interested: 0,
      converted: 0,
      lost: 0
    };
    statusStats.forEach(s => {
      byStatus[s._id] = s.count;
    });

    const bySource = {};
    sourceStats.forEach(s => {
      bySource[s._id] = s.count;
    });

    // Fetch Admin notifications
    const [admin, messages] = await Promise.all([
      User.findOne({ role: 'admin' }),
      Message.find({ recipient: counsellorId })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    res.render('counsellor/dashboard', {
      title: 'Counsellor Dashboard',
      user: req.user,
      followupLeads,
      recentLeads,
      overdueCallbacks,
      todayCallbacks,
      feeCallbacks,
      sourceStats: sourceStatsMap,
      admin,
      messages,
      stats: {
        total,
        newToday,
        followupsDue,
        converted,
        lost,
        byStatus,
        bySource
      }
    });
  } catch (err) {
    console.error('❌ Counsellor Dashboard Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

// ─── LEADS ────────────────────────────────────────────────────────────────────

exports.getLeads = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { assignedTo: req.user._id };
    if (status) filter.status = status;
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ];
    }

    const leads = await Lead.find(filter).sort({ followUpDate: 1, createdAt: -1 });
    res.render('counsellor/leads', { title: 'My Leads', user: req.user, leads, filter: req.query, filters: req.query });
  } catch (err) {
    console.error('❌ Counsellor Leads Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

exports.getCreateLead = (req, res) => {
  res.render('counsellor/lead-form', { title: 'New Lead', user: req.user, target: null });
};

exports.postCreateLead = async (req, res) => {
  const data = { ...req.body, assignedTo: req.user._id };
  console.log('💼 Create Lead request:', { name: data.name, phone: data.phone, course: data.course });
  try {
    const lead = await Lead.create(data);
    console.log('✅ Lead created successfully:', { leadId: lead._id, name: lead.name });
    res.redirect('/counsellor/leads?created=1');
  } catch (err) {
    console.error('❌ Create Lead Error:', err);
    res.render('counsellor/lead-form', { title: 'New Lead', user: req.user, target: null, error: err.message });
  }
};

exports.getLeadDetail = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user._id })
      .populate('followUpHistory.doneBy', 'name role')
      .populate('convertedStudent', 'name');
    if (!lead) {
      console.warn(`⚠️ Counsellor unauthorized lead detail request for lead ID ${req.params.id}`);
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    res.render('counsellor/lead-detail', { title: lead.name, user: req.user, lead });
  } catch (err) {
    console.error('❌ Counsellor Lead Detail Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

exports.postEditLead = async (req, res) => {
  try {
    const { name, phone, email, course, source, notes, followUpDate } = req.body;
    const updated = await Lead.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user._id },
      { name, phone, email, course, source, notes, followUpDate },
    );
    if (!updated) {
      console.warn(`⚠️ Counsellor unauthorized lead edit request for lead ID ${req.params.id}`);
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    res.redirect(`/counsellor/leads/${req.params.id}?updated=1`);
  } catch (err) {
    res.redirect(`/counsellor/leads/${req.params.id}?error=1`);
  }
};

exports.postAddFollowUp = async (req, res) => {
  const { note, status, followUpDate, channel, callDuration, callOutcome } = req.body;
  console.log('📞 Add follow-up request:', { leadId: req.params.id, status, followUpDate, channel });
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!lead) {
      console.warn(`⚠️ Counsellor unauthorized lead followup request for lead ID ${req.params.id}`);
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }

    const followUpObj = {
      note,
      status,
      channel: channel || 'Call',
      doneBy: req.user._id
    };

    if (followUpObj.channel === 'Call') {
      const callCount = lead.followUpHistory.filter(h => h.channel === 'Call').length;
      followUpObj.callAttemptNumber = callCount + 1;
      followUpObj.callDuration = callDuration || '';
      followUpObj.callOutcome = callOutcome || 'answered';
    }

    lead.followUpHistory.push(followUpObj);
    lead.status = status;
    if (followUpDate) lead.followUpDate = new Date(followUpDate);
    await lead.save();

    console.log('✅ Follow-up logged successfully:', { leadId: req.params.id, status: lead.status });
    res.redirect(`/counsellor/leads/${req.params.id}?followup=1`);
  } catch (err) {
    console.error('❌ Add Lead Follow-up Error:', err);
    res.redirect(`/counsellor/leads/${req.params.id}?error=1`);
  }
};

exports.postMarkLost = async (req, res) => {
  console.log('🥀 Mark lead lost request:', { leadId: req.params.id });
  try {
    const updated = await Lead.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user._id },
      { status: 'lost' },
    );
    if (!updated) {
      console.warn(`⚠️ Counsellor unauthorized lead lost request for lead ID ${req.params.id}`);
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    console.log('✅ Lead marked as lost:', { leadId: req.params.id });
    res.redirect('/counsellor/leads');
  } catch (err) {
    console.error('❌ Mark Lead Lost Error:', err);
    res.redirect('/counsellor/leads?error=1');
  }
};

// ─── WALK-IN ENTRY (quick lead) ───────────────────────────────────────────────

exports.postWalkIn = async (req, res) => {
  const { name, phone, course } = req.body;
  console.log('🚶 Walk-in entry request:', { name, phone, course });
  try {
    const lead = await Lead.create({
      name,
      phone,
      course: course || 'Undecided',
      source: 'Walk-in',
      status: 'new',
      assignedTo: req.user._id,
    });
    console.log('✅ Walk-in lead created successfully:', { leadId: lead._id, name: lead.name });
    res.redirect('/counsellor/leads?walkin=1');
  } catch (err) {
    console.error('❌ Walk-in Lead Error:', err);
    res.redirect('/counsellor/leads?error=1');
  }
};

// GET /counsellor/leads/followups
exports.getFollowUps = async (req, res) => {
  try {
    const leads = await Lead.find({
      assignedTo: req.user._id,
      followUpDate: { $lte: new Date() },
      status: { $nin: ['converted', 'lost'] }
    }).sort({ followUpDate: 1 });
    res.render('counsellor/followups', {
      title: 'Follow-ups',
      user: req.user,
      leads
    });
  } catch (err) {
    console.error('❌ Follow-ups Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

// GET /counsellor/admissions
exports.getAdmissions = async (req, res) => {
  const { search } = req.query;
  const logger = require('../utils/logger');
  try {
    const query = {
      assignedTo: req.user._id,
      status: 'converted',
      convertedStudent: { $exists: true, $ne: null }
    };
    
    let convertedLeads = await Lead.find(query)
      .populate('convertedStudent')
      .sort({ updatedAt: -1 });

    if (search) {
      const searchLower = search.toLowerCase().trim();
      convertedLeads = convertedLeads.filter(lead => 
        lead.convertedStudent && 
        lead.convertedStudent.name.toLowerCase().includes(searchLower)
      );
    }

    const studentIds = convertedLeads.map(l => l.convertedStudent._id).filter(Boolean);
    const fees = await Fee.find({ student: { $in: studentIds } });

    const students = convertedLeads.map(lead => {
      const student = lead.convertedStudent;
      const fee = fees.find(f => String(f.student) === String(student._id));
      
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
        student,
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
 * Scoped read-only fee detail view for counsellor converted students.
 */
exports.getStudentFee = async (req, res) => {
  const logger = require('../utils/logger');
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student' || String(student.counsellor) !== String(req.user._id)) {
      logger.warn('Unauthorized fee details request by counsellor', { studentId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
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
 * POST /counsellor/leads/:id/ready
 * Counsellor marks lead as ready to convert (handoff to admin).
 */
exports.postMarkReady = async (req, res) => {
  const logger = require('../utils/logger');
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!lead) {
      logger.warn('Unauthorized mark ready request by counsellor', { leadId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    lead.status = 'ready_to_convert';
    await lead.save();
    logger.info('Lead marked as ready to convert', { leadId: lead._id });
    res.redirect(`/counsellor/leads/${req.params.id}?updated=1`);
  } catch (err) {
    logger.error('Mark Lead Ready Error', { err: err.message });
    res.redirect(`/counsellor/leads/${req.params.id}?error=1`);
  }
};

// GET /counsellor/leads/:id/convert
exports.getConvertLead = async (req, res) => {
  console.log('🚶 GET convert lead form request:', { leadId: req.params.id });
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!lead) {
      console.warn(`⚠️ Counsellor unauthorized lead convert request for lead ID ${req.params.id}`);
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }

    // Fetch distinct active batches from students roster
    const batches = await User.distinct('batch', { role: 'student', isActive: true });
    
    // Add default batches if none exist
    if (batches.length === 0) {
      batches.push('Morning Batch', 'Afternoon Batch', 'Evening Batch');
    }

    res.render('counsellor/convert', {
      title: `Convert: ${lead.name}`,
      user: req.user,
      lead,
      batches
    });
  } catch (err) {
    console.error('❌ Get Convert Lead Error:', err);
    res.redirect(`/counsellor/leads/${req.params.id}?error=1`);
  }
};

// POST /counsellor/leads/:id/convert
exports.postConvertLead = async (req, res) => {
  console.log('💼 POST convert lead request:', { leadId: req.params.id });
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!lead) {
      console.warn(`⚠️ Counsellor unauthorized lead convert request for lead ID ${req.params.id}`);
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }

    const totalFees = Number(req.body.fees_total) || 0;
    const paidFees = Number(req.body.fees_paid) || 0;
    const minDownPayment = totalFees * 0.5;

    const batches = await User.distinct('batch', { role: 'student', isActive: true });
    if (batches.length === 0) {
      batches.push('Morning Batch', 'Afternoon Batch', 'Evening Batch');
    }

    if (paidFees < minDownPayment) {
      return res.render('counsellor/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
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
        error: 'A valid email address is required.'
      });
    }

    if (!password || password.length < 8) {
      return res.render('counsellor/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        error: 'Password must be at least 8 characters long.'
      });
    }

    // Check duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('counsellor/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches,
        error: 'This email address is already registered.'
      });
    }

    const batchName = (req.body.batch && req.body.batch.trim()) ? req.body.batch.trim() : 'General Batch';

    // Create the active student user account
    const student = await User.create({
      name: req.body.name,
      email: email,
      password: password,
      role: 'student',
      phone: req.body.phone,
      course: req.body.course,
      batch: batchName,
      enrollmentDate: req.body.enrollmentDate ? new Date(req.body.enrollmentDate) : new Date(),
      fees_total: totalFees,
      fees_paid: paidFees,
      counsellor: req.user._id // assign current counsellor
    });

    const Fee = require('../models/Fee');
    // Create corresponding Fee ledger record
    const feeLedger = new Fee({
      student: student._id,
      course: student.course,
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

    // Update the lead status & link student record
    lead.status = 'converted';
    lead.convertedStudent = student._id;
    lead.convertedAt = new Date();
    await lead.save();

    console.log('✅ Lead converted to student successfully by Counsellor:', { leadId: lead._id, studentId: student._id });
    res.redirect('/counsellor/admissions?converted=1');
  } catch (err) {
    console.error('❌ Post Convert Lead Error:', err);
    res.redirect(`/counsellor/leads/${req.params.id}?error=1`);
  }
};

// DELETE /counsellor/leads/:id
exports.deleteLead = async (req, res) => {
  console.log('🗑️ Delete lead request:', { leadId: req.params.id });
  try {
    const deleted = await Lead.findOneAndDelete({ _id: req.params.id, assignedTo: req.user._id });
    if (!deleted) {
      console.warn(`⚠️ Counsellor unauthorized lead delete request for lead ID ${req.params.id}`);
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    console.log('✅ Lead deleted successfully:', { leadId: req.params.id });
    res.redirect('/counsellor/leads?deleted=1');
  } catch (err) {
    console.error('❌ Delete Lead Error:', err);
    res.redirect('/counsellor/leads?error=1');
  }
};

// POST /counsellor/messages/send
exports.postSendMessage = async (req, res) => {
  const { recipientId, content, redirect } = req.body;
  const targetRedirect = safeRedirect(redirect, '/counsellor/dashboard');
  console.log('💬 Counsellor sending message note:', { senderId: req.user._id, recipientId, content });
  try {
    const { validateAndSanitizeMessage } = require('../utils/messageValidator');
    const { cleanContent } = await validateAndSanitizeMessage(req.user, recipientId, content);

    await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content: cleanContent,
    });
    res.redirect(targetRedirect.includes('?') ? `${targetRedirect}&posted=1` : `${targetRedirect}?posted=1`);
  } catch (err) {
    console.error('❌ Counsellor Send Message Error:', err);
    const errQuery = `error=${encodeURIComponent(err.message)}`;
    res.redirect(targetRedirect.includes('?') ? `${targetRedirect}&${errQuery}` : `${targetRedirect}?${errQuery}`);
  }
};