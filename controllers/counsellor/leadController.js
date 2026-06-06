const Lead = require('../../models/Lead');
const User = require('../../models/User');
const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');

/**
 * GET /counsellor/leads
 * Lists this counsellor's assigned leads, filtered by status and/or search term.
 */
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
    res.render('counsellor/leads', {
      title: 'My Leads', user: req.user, leads, filter: req.query, filters: req.query,
    });
  } catch (err) {
    console.error('❌ Counsellor Leads Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /counsellor/leads/create
 * Renders the new lead creation form.
 */
exports.getCreateLead = (req, res) => {
  res.render('counsellor/lead-form', { title: 'New Lead', user: req.user, target: null });
};

/**
 * POST /counsellor/leads/create
 * Creates a new lead assigned to this counsellor.
 */
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

/**
 * GET /counsellor/leads/:id
 * Shows the full lead detail page including follow-up history and admin notes.
 * Only accessible to the assigned counsellor.
 */
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

/**
 * POST /counsellor/leads/:id/edit
 * Updates basic lead information (contact details, course interest, follow-up date).
 */
exports.postEditLead = async (req, res) => {
  try {
    const { name, phone, email, course, source, notes, followUpDate } = req.body;
    const updated = await Lead.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user._id },
      { name, phone, email, course, source, notes, followUpDate }
    );
    if (!updated) {
      console.warn(`⚠️ Counsellor unauthorized lead edit for lead ID ${req.params.id}`);
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    res.redirect(`/counsellor/leads/${req.params.id}?updated=1`);
  } catch (err) {
    res.redirect(`/counsellor/leads/${req.params.id}?error=1`);
  }
};

/**
 * POST /counsellor/leads/:id/followup
 * Appends a follow-up interaction log to the lead's history and updates its status.
 * Tracks call attempt number, duration, and outcome for phone interactions.
 */
exports.postAddFollowUp = async (req, res) => {
  const { note, status, followUpDate, channel, callDuration, callOutcome } = req.body;
  console.log('📞 Add follow-up request:', { leadId: req.params.id, status, channel });
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!lead) {
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }

    const followUpObj = { note, status, channel: channel || 'Call', doneBy: req.user._id };

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

    console.log('✅ Follow-up logged:', { leadId: req.params.id, status: lead.status });
    res.redirect(`/counsellor/leads/${req.params.id}?followup=1`);
  } catch (err) {
    console.error('❌ Add Lead Follow-up Error:', err);
    res.redirect(`/counsellor/leads/${req.params.id}?error=1`);
  }
};

/**
 * POST /counsellor/leads/:id/lost
 * Marks a lead as lost.
 */
exports.postMarkLost = async (req, res) => {
  console.log('🥀 Mark lead lost request:', { leadId: req.params.id });
  try {
    const updated = await Lead.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user._id },
      { status: 'lost' }
    );
    if (!updated) return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    res.redirect('/counsellor/leads');
  } catch (err) {
    console.error('❌ Mark Lead Lost Error:', err);
    res.redirect('/counsellor/leads?error=1');
  }
};

/**
 * POST /counsellor/leads/walkin
 * Quick-creates a Walk-in lead with minimal information.
 */
exports.postWalkIn = async (req, res) => {
  const { name, phone, course } = req.body;
  console.log('🚶 Walk-in entry request:', { name, phone, course });
  try {
    const lead = await Lead.create({
      name, phone,
      course: course || 'Undecided',
      source: 'Walk-in',
      status: 'new',
      assignedTo: req.user._id,
    });
    console.log('✅ Walk-in lead created:', { leadId: lead._id });
    res.redirect('/counsellor/leads?walkin=1');
  } catch (err) {
    console.error('❌ Walk-in Lead Error:', err);
    res.redirect('/counsellor/leads?error=1');
  }
};

/**
 * GET /counsellor/leads/followups
 * Lists all leads with a follow-up date that is today or overdue,
 * excluding converted and lost leads.
 */
exports.getFollowUps = async (req, res) => {
  try {
    const leads = await Lead.find({
      assignedTo: req.user._id,
      followUpDate: { $lte: new Date() },
      status: { $nin: ['converted', 'lost'] },
    }).sort({ followUpDate: 1 });
    res.render('counsellor/followups', { title: 'Follow-ups', user: req.user, leads });
  } catch (err) {
    console.error('❌ Follow-ups Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

/**
 * POST /counsellor/leads/:id/ready
 * Flags a lead as ready_to_convert, signalling the admin to finalise admission.
 */
exports.postMarkReady = async (req, res) => {
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

/**
 * DELETE /counsellor/leads/:id
 * Deletes a lead. Only the assigned counsellor may delete their own leads.
 */
exports.deleteLead = async (req, res) => {
  console.log('🗑️ Delete lead request:', { leadId: req.params.id });
  try {
    const deleted = await Lead.findOneAndDelete({ _id: req.params.id, assignedTo: req.user._id });
    if (!deleted) return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    res.redirect('/counsellor/leads?deleted=1');
  } catch (err) {
    console.error('❌ Delete Lead Error:', err);
    res.redirect('/counsellor/leads?error=1');
  }
};