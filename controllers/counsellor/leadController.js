const Lead = require('../../models/Lead');
const User = require('../../models/User');
const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');
const Message = require('../../models/Message');

/**
 * GET /counsellor/leads
 * Lists this counsellor's assigned leads, filtered by status and/or search term.
 */
exports.getLeads = async (req, res) => {
  try {
    const { status, search, course } = req.query;
    const filter = { assignedTo: req.user.counsellorProfileId };
    if (status) filter.status = status;
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (course) {
      if (course === 'Undecided') {
        filter.interestedCourse = null;
      } else {
        const Course = require('../../models/Course');
        const courseDoc = await Course.findOne({ name: course });
        if (courseDoc) {
          filter.interestedCourse = courseDoc._id;
        }
      }
    }
    const leads = await Lead.find(filter).populate('interestedCourse').sort({ nextFollowUpAt: 1, createdAt: -1 });
    res.render('counsellor/leads', {
      title: 'My Leads', user: req.user, leads, filter: req.query, filters: req.query,
    });
  } catch (err) {
    logger.error('Counsellor Leads Fetch Error', { err: err.message });
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
  try {
    const Course = require('../../models/Course');
    const { name, phone, email, course, source, status, followUpDate, notes } = req.body;
    let interestedCourse = null;
    if (course && course !== 'Both' && course !== 'Undecided') {
      const courseDoc = await Course.findOne({ name: course });
      if (courseDoc) interestedCourse = courseDoc._id;
    }
    const leadData = {
      name,
      phone,
      email,
      interestedCourse,
      source,
      status,
      nextFollowUpAt: followUpDate ? new Date(followUpDate) : null,
      notes: notes || '',
      assignedTo: req.user.counsellorProfileId
    };
    const lead = await Lead.create(leadData);
    logger.info('Lead created successfully', { leadId: lead._id, name: lead.name });
    res.redirect('/counsellor/leads?created=1');
  } catch (err) {
    logger.error('Create Lead Error', { err: err.message });
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
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user.counsellorProfileId })
      .populate('interestedCourse')
      .populate('followUpHistory.doneBy', 'name role')
      .populate('convertedStudent', 'name');
    if (!lead) {
      logger.warn('Counsellor unauthorized lead detail request', { leadId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    res.render('counsellor/lead-detail', { title: lead.name, user: req.user, lead });
  } catch (err) {
    logger.error('Counsellor Lead Detail Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /counsellor/leads/:id/edit
 * Renders the lead edit form populated with current lead details.
 */
exports.getEditLead = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user.counsellorProfileId }).populate('interestedCourse');
    if (!lead) {
      logger.warn('Counsellor unauthorized edit page request', { leadId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    res.render('counsellor/lead-form', { title: 'Edit Lead', user: req.user, lead, target: lead });
  } catch (err) {
    logger.error('Counsellor Edit Lead Page Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

/**
 * POST /counsellor/leads/:id/edit
 * Updates basic lead information (contact details, course interest, follow-up date).
 */
exports.postEditLead = async (req, res) => {
  try {
    const Course = require('../../models/Course');
    const { name, phone, email, course, source, notes, followUpDate } = req.body;
    let interestedCourse = null;
    if (course && course !== 'Both' && course !== 'Undecided') {
      const courseDoc = await Course.findOne({ name: course });
      if (courseDoc) interestedCourse = courseDoc._id;
    }
    const updated = await Lead.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user.counsellorProfileId },
      {
        name,
        phone,
        email,
        interestedCourse,
        source,
        notes: notes || '',
        nextFollowUpAt: followUpDate ? new Date(followUpDate) : null
      }
    );
    if (!updated) {
      logger.warn('Counsellor unauthorized lead edit request', { leadId: req.params.id });
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
  logger.info('Add follow-up request', { leadId: req.params.id, status, channel });
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user.counsellorProfileId });
    if (!lead) {
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }

    let finalStatus = status;
    if (status === 'interested') finalStatus = 'joining_interested';

    // Server-side status validation guard (Issue 2.11 / 4.1)
    const validStatuses = ['new', 'contacted', 'mentorship_scheduled', 'mentorship_attended', 'follow_up', 'joining_interested', 'admission_completed', 'lost'];
    if (!validStatuses.includes(finalStatus)) {
      logger.warn('Invalid status update parameter submitted', { status: finalStatus });
      return res.redirect(`/counsellor/leads/${req.params.id}?error=Invalid+status+action`);
    }

    const followUpObj = { note, status: finalStatus, channel: channel || 'Call', doneBy: req.user._id };

    if (followUpObj.channel === 'Call') {
      const callCount = lead.followUpHistory.filter(h => h.channel === 'Call').length;
      followUpObj.callAttemptNumber = callCount + 1;
      followUpObj.callDuration = callDuration || '';
      followUpObj.callOutcome = callOutcome || 'answered';
    }

    lead.followUpHistory.push(followUpObj);
    lead.status = finalStatus;
    if (followUpDate) lead.nextFollowUpAt = new Date(followUpDate);
    await lead.save();

    logger.info('Follow-up logged successfully', { leadId: req.params.id, status: lead.status });
    res.redirect(`/counsellor/leads/${req.params.id}?followup=1`);
  } catch (err) {
    logger.error('Add Lead Follow-up Error', { err: err.message });
    res.redirect(`/counsellor/leads/${req.params.id}?error=1`);
  }
};

/**
 * POST /counsellor/leads/:id/followup/:index/edit
 * Edits the note of an existing follow-up log in the timeline.
 */
exports.postEditFollowUp = async (req, res) => {
  const { note } = req.body;
  const index = parseInt(req.params.index);
  logger.info('Edit follow-up request', { leadId: req.params.id, index });
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user.counsellorProfileId });
    if (!lead) {
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }

    // Check bounds
    if (isNaN(index) || index < 0 || index >= lead.followUpHistory.length) {
      return res.redirect(`/counsellor/leads/${req.params.id}?error=Invalid+log+index`);
    }

    // Only allow updating note
    lead.followUpHistory[index].note = note;
    await lead.save();

    logger.info('Follow-up updated successfully', { leadId: req.params.id, index });
    res.redirect(`/counsellor/leads/${req.params.id}?updated=1`);
  } catch (err) {
    logger.error('Edit Lead Follow-up Error', { err: err.message });
    res.redirect(`/counsellor/leads/${req.params.id}?error=1`);
  }
};

/**
 * POST /counsellor/leads/:id/lost
 * Marks a lead as lost.
 */
exports.postMarkLost = async (req, res) => {
  logger.info('Mark lead lost request', { leadId: req.params.id });
  try {
    const updated = await Lead.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user.counsellorProfileId },
      { status: 'lost' }
    );
    if (!updated) return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    res.redirect('/counsellor/leads');
  } catch (err) {
    logger.error('Mark Lead Lost Error', { err: err.message });
    res.redirect('/counsellor/leads?error=1');
  }
};

/**
 * POST /counsellor/leads/walkin
 * Quick-creates a Walk-in lead with minimal information.
 */
exports.postWalkIn = async (req, res) => {
  const { name, phone, course } = req.body;
  logger.info('Walk-in entry request', { name, phone, course });
  try {
    const Course = require('../../models/Course');
    let interestedCourse = null;
    if (course && course !== 'Both' && course !== 'Undecided') {
      const courseDoc = await Course.findOne({ name: course });
      if (courseDoc) interestedCourse = courseDoc._id;
    }
    const lead = await Lead.create({
      name, phone,
      interestedCourse,
      source: 'Walk-in',
      status: 'new',
      assignedTo: req.user.counsellorProfileId,
    });
    logger.info('Walk-in lead created successfully', { leadId: lead._id });
    res.redirect('/counsellor/leads?walkin=1');
  } catch (err) {
    logger.error('Walk-in Lead Error', { err: err.message });
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
      assignedTo: req.user.counsellorProfileId,
      nextFollowUpAt: { $lte: new Date() },
      status: { $nin: ['admission_completed', 'lost'] },
    }).populate('interestedCourse').sort({ nextFollowUpAt: 1 });
    res.render('counsellor/followups', { title: 'Follow-ups', user: req.user, leads });
  } catch (err) {
    logger.error('Follow-ups Fetch Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

/**
 * POST /counsellor/leads/:id/ready
 * Flags a lead as joining_interested, signalling the admin to finalise admission.
 */
exports.postMarkReady = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user.counsellorProfileId });
    if (!lead) {
      logger.warn('Unauthorized mark ready request by counsellor', { leadId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    lead.status = 'joining_interested';
    await lead.save();
    logger.info('Lead marked as ready to convert', { leadId: lead._id });

    // Send notification to admin (Issue 2.8)
    const adminUser = await User.findOne({ role: 'admin' });
    if (adminUser) {
      await Message.create({
        sender: req.user._id,
        recipient: adminUser._id,
        content: `Lead handoff alert: "${lead.name}" is marked ready for admission conversion. URL: /admin/leads/${lead._id}`,
      });
    }

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
  logger.info('Delete lead request', { leadId: req.params.id });
  try {
    const deleted = await Lead.findOneAndDelete({ _id: req.params.id, assignedTo: req.user.counsellorProfileId });
    if (!deleted) return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    res.redirect('/counsellor/leads?deleted=1');
  } catch (err) {
    logger.error('Delete Lead Error', { err: err.message });
    res.redirect('/counsellor/leads?error=1');
  }
};
