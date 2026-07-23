const Lead = require('../../models/Lead');
const User = require('../../models/User');
const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');
const Message = require('../../models/Message');
const LeadActivity = require('../../models/LeadActivity');
const Course = require('../../models/Course');
const {
  nextBusinessFollowUpDate,
  notifyAdmins,
  recordLeadCreation,
  resolveCourse
} = require('../../utils/leadAutomation');
const {
  getClosedLeadStatusKeys,
  getLeadStatuses,
  isValidLeadStatus
} = require('../../utils/leadStatusOptions');

function getLeadActivityType(status, channel) {
  if (channel === 'Call') return 'call';
  if (channel === 'WhatsApp') return 'whatsapp';
  if (status === 'mentorship_scheduled') return 'mentorship_scheduled';
  if (status === 'mentorship_attended') return 'mentorship_attended';
  if (status === 'lost') return 'lost';
  if (status === 'joining_interested') return 'status_changed';
  return 'follow_up_completed';
}

/**
 * GET /counsellor/leads
 * Lists this counsellor's assigned leads, filtered by status and/or search term.
 */
exports.getLeads = async (req, res) => {
  try {
    const { status, search, course, source } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 10), 100);
    const skip = (page - 1) * limit;
    const filter = { assignedTo: req.user.counsellorProfileId };
    if (status) filter.status = status;
    if (source) filter.source = source;
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
    const baseFilter = { assignedTo: req.user.counsellorProfileId };
    const closedStatuses = await getClosedLeadStatusKeys();
    const [leads, totalLeads, activeCount, followupDueCount, convertedCount, leadStatuses, courses] = await Promise.all([
      Lead.find(filter)
        .populate('interestedCourse')
        .sort({ nextFollowUpAt: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(filter),
      Lead.countDocuments({
        ...baseFilter,
        status: { $nin: closedStatuses }
      }),
      Lead.countDocuments({
        ...baseFilter,
        status: { $nin: closedStatuses },
        nextFollowUpAt: { $lte: new Date() }
      }),
      Lead.countDocuments({
        ...baseFilter,
        status: 'admission_completed'
      }),
      getLeadStatuses(),
      Course.find({ isActive: true }).select('name code').sort({ name: 1 })
    ]);
    res.render('counsellor/leads', {
      title: 'My Leads',
      user: req.user,
      leads,
      pagination: {
        page,
        limit,
        total: totalLeads,
        pages: Math.max(Math.ceil(totalLeads / limit), 1)
      },
      stats: {
        activeCount,
        followupDueCount,
        convertedCount
      },
      leadStatuses,
      courses,
      filter: req.query,
      filters: req.query,
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
exports.getCreateLead = async (req, res) => {
  const [leadStatuses, courses] = await Promise.all([
    getLeadStatuses(),
    Course.find({ isActive: true }).select('name code').sort({ name: 1 })
  ]);
  res.render('counsellor/lead-form', { title: 'New Lead', user: req.user, target: null, leadStatuses, courses });
};

/**
 * POST /counsellor/leads/create
 * Creates a new lead assigned to this counsellor.
 */
exports.postCreateLead = async (req, res) => {
  try {
    const { name, phone, email, course, source, referredBy, status, followUpDate, notes } = req.body;
    const cleanPhone = String(phone || '').trim();
    const duplicate = await Lead.findOne({ phone: cleanPhone }).select('_id name assignedTo status');
    if (duplicate) {
      const [leadStatuses, courses] = await Promise.all([
        getLeadStatuses(),
        Course.find({ isActive: true }).select('name code').sort({ name: 1 })
      ]);
      return res.render('counsellor/lead-form', {
        title: 'New Lead',
        user: req.user,
        target: null,
        error: `A lead with this phone number already exists for ${duplicate.name}.`,
        leadStatuses,
        courses
      });
    }

    const courseDoc = await resolveCourse(course);
    const cleanStatus = status && await isValidLeadStatus(status) ? status : 'new';
    const leadData = {
      name,
      phone: cleanPhone,
      email,
      interestedCourse: courseDoc ? courseDoc._id : null,
      source,
      referredBy: source === 'Referral' ? String(referredBy || '').trim().slice(0, 100) : '',
      status: cleanStatus,
      nextFollowUpAt: followUpDate ? new Date(followUpDate) : nextBusinessFollowUpDate(),
      notes: notes || '',
      assignedTo: req.user.counsellorProfileId,
      createdBy: req.user._id,
      ownershipHistory: [{
        counsellor: req.user.counsellorProfileId,
        assignedBy: req.user._id,
        note: 'Lead created directly by counsellor.'
      }]
    };
    const lead = await Lead.create(leadData);
    await recordLeadCreation({
      lead,
      actorUser: req.user,
      assignedCounsellor: { _id: req.user.counsellorProfileId, user: req.user },
      note: `Lead created by counsellor from ${source || 'manual entry'}.`
    });
    await notifyAdmins({
      lead,
      assignedCounsellor: { _id: req.user.counsellorProfileId, user: req.user },
      actorUser: req.user,
      sourceLabel: source || 'manual'
    });
    logger.info('Lead created successfully', { leadId: lead._id, name: lead.name });
    res.redirect('/counsellor/leads?created=1');
  } catch (err) {
    logger.error('Create Lead Error', { err: err.message });
    const [leadStatuses, courses] = await Promise.all([
      getLeadStatuses(),
      Course.find({ isActive: true }).select('name code').sort({ name: 1 })
    ]);
    res.render('counsellor/lead-form', { title: 'New Lead', user: req.user, target: null, error: err.message, leadStatuses, courses });
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
    const leadActivities = await LeadActivity.find({ lead: lead._id })
      .populate('doneBy', 'name role')
      .populate('counsellor', 'name role')
      .sort({ createdAt: 1 });
    const leadStatuses = await getLeadStatuses();
    res.render('counsellor/lead-detail', { title: lead.name, user: req.user, lead, leadActivities, leadStatuses });
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
    const [leadStatuses, courses] = await Promise.all([
      getLeadStatuses(),
      Course.find({ isActive: true }).select('name code').sort({ name: 1 })
    ]);
    res.render('counsellor/lead-form', { title: 'Edit Lead', user: req.user, lead, target: lead, leadStatuses, courses });
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
    const { name, phone, email, course, source, referredBy, status, notes, followUpDate } = req.body;
    const cleanPhone = String(phone || '').trim();
    const duplicate = await Lead.findOne({
      phone: cleanPhone,
      _id: { $ne: req.params.id }
    }).select('_id name');
    if (duplicate) {
      return res.redirect(`/counsellor/leads/${req.params.id}/edit?error=${encodeURIComponent('Another lead already uses this phone number')}`);
    }

    const courseDoc = await resolveCourse(course);
    const interestedCourse = courseDoc?._id || null;
    const cleanStatus = status && await isValidLeadStatus(status) ? status : 'new';
    const updated = await Lead.findOneAndUpdate(
      { _id: req.params.id, assignedTo: req.user.counsellorProfileId },
      {
        name,
        phone: cleanPhone,
        email,
        interestedCourse,
        source,
        referredBy: source === 'Referral' ? String(referredBy || '').trim().slice(0, 100) : '',
        status: cleanStatus,
        notes: notes || '',
        nextFollowUpAt: followUpDate ? new Date(followUpDate) : null
      }
    );
    if (!updated) {
      logger.warn('Counsellor unauthorized lead edit request', { leadId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    await LeadActivity.create({
      lead: updated._id,
      type: 'note',
      title: 'Lead details updated',
      note: 'Counsellor updated lead contact, course, source, notes, or follow-up date.',
      counsellor: req.user._id,
      doneBy: req.user._id,
      followUp: {
        scheduledFor: followUpDate ? new Date(followUpDate) : null
      },
      oldStatus: updated.status,
      newStatus: cleanStatus,
      metadata: { name, phone: cleanPhone, email, source }
    });
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

    if (!(await isValidLeadStatus(finalStatus))) {
      logger.warn('Invalid status update parameter submitted', { status: finalStatus });
      return res.redirect(`/counsellor/leads/${req.params.id}?error=Invalid+status+action`);
    }

    const oldStatus = lead.status;
    const selectedChannel = channel || 'Call';
    const cleanNote = String(note || '').trim();
    const duplicateWindowStart = new Date(Date.now() - 15000);
    const recentDuplicate = lead.followUpHistory.some(item => (
      String(item.doneBy || '') === String(req.user._id) &&
      item.status === finalStatus &&
      item.channel === selectedChannel &&
      String(item.note || '').trim() === cleanNote &&
      new Date(item.doneAt || 0) >= duplicateWindowStart
    ));

    if (recentDuplicate) {
      logger.warn('Duplicate follow-up submission ignored', { leadId: req.params.id, status: finalStatus, channel: selectedChannel });
      return res.redirect(`/counsellor/leads/${req.params.id}?followup=1`);
    }

    const followUpObj = {
      note: cleanNote,
      status: finalStatus,
      channel: selectedChannel,
      doneBy: req.user._id,
      nextFollowUpAt: followUpDate ? new Date(followUpDate) : null
    };

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

    await LeadActivity.create({
      lead: lead._id,
      type: getLeadActivityType(finalStatus, followUpObj.channel),
      title: followUpObj.channel === 'Call' ? 'Call logged' : followUpObj.channel === 'WhatsApp' ? 'WhatsApp follow-up logged' : `${followUpObj.channel} logged`,
      note: cleanNote,
      counsellor: req.user._id,
      doneBy: req.user._id,
      call: {
        outcome: followUpObj.channel === 'Call' ? (callOutcome || 'answered') : 'not-applicable',
        duration: followUpObj.channel === 'Call' ? (callDuration || '') : ''
      },
      whatsapp: {
        direction: followUpObj.channel === 'WhatsApp' ? 'sent' : 'none',
        message: followUpObj.channel === 'WhatsApp' ? cleanNote : ''
      },
      followUp: {
        scheduledFor: followUpDate ? new Date(followUpDate) : null,
        completedAt: new Date()
      },
      oldStatus,
      newStatus: finalStatus
    });

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

    await LeadActivity.create({
      lead: lead._id,
      type: 'note',
      title: 'Follow-up note edited',
      note,
      counsellor: req.user._id,
      doneBy: req.user._id,
      metadata: { followUpIndex: index }
    });

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

    await LeadActivity.create({
      lead: updated._id,
      type: 'lost',
      title: 'Lead marked lost',
      note: 'Counsellor marked this lead as lost.',
      counsellor: req.user._id,
      doneBy: req.user._id,
      oldStatus: updated.status,
      newStatus: 'lost'
    });
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
    const cleanPhone = String(phone || '').trim();
    const duplicate = await Lead.findOne({ phone: cleanPhone }).select('_id name');
    if (duplicate) {
      return res.redirect(`/counsellor/leads?error=${encodeURIComponent('A lead with this phone number already exists')}`);
    }

    const courseDoc = await resolveCourse(course);
    const lead = await Lead.create({
      name, phone: cleanPhone,
      interestedCourse: courseDoc ? courseDoc._id : null,
      source: 'Walk-in',
      status: 'new',
      assignedTo: req.user.counsellorProfileId,
      nextFollowUpAt: nextBusinessFollowUpDate(),
      createdBy: req.user._id,
      ownershipHistory: [{
        counsellor: req.user.counsellorProfileId,
        assignedBy: req.user._id,
        note: 'Walk-in lead created by counsellor.'
      }]
    });
    await recordLeadCreation({
      lead,
      actorUser: req.user,
      assignedCounsellor: { _id: req.user.counsellorProfileId, user: req.user },
      note: 'Counsellor created this lead from a walk-in enquiry.'
    });
    await notifyAdmins({
      lead,
      assignedCounsellor: { _id: req.user.counsellorProfileId, user: req.user },
      actorUser: req.user,
      sourceLabel: 'Walk-in'
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
      status: { $nin: await getClosedLeadStatusKeys() },
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
    const oldStatus = lead.status;
    lead.status = 'joining_interested';
    await lead.save();
    await LeadActivity.create({
      lead: lead._id,
      type: 'status_changed',
      title: 'Marked ready for admission',
      note: 'Counsellor marked this lead as ready for admin admission conversion.',
      counsellor: req.user._id,
      doneBy: req.user._id,
      oldStatus,
      newStatus: 'joining_interested'
    });
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
    const lead = await Lead.findOne({ _id: req.params.id, assignedTo: req.user.counsellorProfileId });
    if (!lead) return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    if (lead.convertedStudent || lead.status === 'admission_completed') {
      return res.redirect(`/counsellor/leads/${lead._id}?error=${encodeURIComponent('Admitted leads are retained as student history and cannot be deleted.')}`);
    }
    lead.archivedAt = new Date();
    await lead.save();
    res.redirect('/counsellor/leads?deleted=1');
  } catch (err) {
    logger.error('Delete Lead Error', { err: err.message });
    res.redirect('/counsellor/leads?error=1');
  }
};
