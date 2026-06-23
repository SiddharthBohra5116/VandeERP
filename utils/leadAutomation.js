const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const Counsellor = require('../models/Counsellor');
const User = require('../models/User');
const Message = require('../models/Message');
const Course = require('../models/Course');

const OPEN_STATUSES = ['new', 'contacted', 'mentorship_scheduled', 'mentorship_attended', 'follow_up', 'joining_interested'];

function nextBusinessFollowUpDate(now = new Date()) {
  const followUp = new Date(now);
  const hour = followUp.getHours();

  if (hour >= 18) {
    followUp.setDate(followUp.getDate() + 1);
    followUp.setHours(10, 30, 0, 0);
  } else if (hour < 10) {
    followUp.setHours(11, 0, 0, 0);
  } else {
    followUp.setHours(followUp.getHours() + 2, 0, 0, 0);
  }

  const day = followUp.getDay();
  if (day === 0) followUp.setDate(followUp.getDate() + 1);

  return followUp;
}

function normalizeLeadSource(source) {
  const value = String(source || '').trim().toLowerCase();
  if (value.includes('instagram')) return 'Instagram';
  if (value.includes('facebook') || value === 'fb') return 'Facebook';
  if (value.includes('whatsapp')) return 'WhatsApp';
  if (value.includes('website')) return 'Website';
  if (value.includes('referral')) return 'Referral';
  if (value.includes('linkedin')) return 'LinkedIn';
  if (value.includes('ad')) return 'Advertisement';
  if (value.includes('walk')) return 'Walk-in';
  return source || 'Manual';
}

async function resolveCourse(courseValue) {
  const value = String(courseValue || '').trim();
  if (!value || value === 'Both' || value === 'Undecided') return null;
  return Course.findOne({
    $or: [
      { name: value },
      { code: value.toUpperCase() }
    ]
  });
}

async function chooseBestCounsellor() {
  const profiles = await Counsellor.find().populate('user', 'name email phone status');
  const activeProfiles = profiles.filter(profile => profile.user && profile.user.status === 'active');

  if (!activeProfiles.length) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const scored = await Promise.all(activeProfiles.map(async profile => {
    const [openCount, dueTodayCount] = await Promise.all([
      Lead.countDocuments({ assignedTo: profile._id, status: { $in: OPEN_STATUSES } }),
      Lead.countDocuments({
        assignedTo: profile._id,
        status: { $in: OPEN_STATUSES },
        nextFollowUpAt: { $gte: todayStart, $lt: tomorrow }
      })
    ]);

    return {
      profile,
      openCount,
      dueTodayCount,
      score: openCount * 2 + dueTodayCount
    };
  }));

  scored.sort((a, b) =>
    a.score - b.score
    || a.openCount - b.openCount
    || new Date(a.profile.updatedAt) - new Date(b.profile.updatedAt)
  );

  return scored[0].profile;
}

async function notifyAdmins({ lead, assignedCounsellor, actorUser, sourceLabel }) {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id name');
  const sender = actorUser || admins[0];
  if (!sender) return;

  const leadUrl = `/admin/leads/${lead._id}`;
  await Promise.all(admins.map(admin => Message.create({
    sender: sender._id,
    recipient: admin._id,
    content: [
      `New ${sourceLabel || lead.source} lead: ${lead.name}`,
      `Assigned counsellor: ${assignedCounsellor?.user?.name || 'Unassigned'}`,
      `Follow-up: ${lead.nextFollowUpAt ? lead.nextFollowUpAt.toLocaleString('en-IN') : 'Not scheduled'}`,
      `Open lead: ${leadUrl}`
    ].join('\n')
  })));
}

async function notifyAssignedCounsellor({ lead, assignedCounsellor, actorUser }) {
  if (!assignedCounsellor?.user?._id) return;

  const admin = await User.findOne({ role: 'admin', status: 'active' }).select('_id');
  const sender = actorUser || admin;
  if (!sender) return;

  const leadUrl = `/counsellor/leads/${lead._id}`;
  await Message.create({
    sender: sender._id,
    recipient: assignedCounsellor.user._id,
    content: [
      `New lead assigned: ${lead.name}`,
      `Source: ${lead.source}`,
      `Phone: ${lead.phone}`,
      `First follow-up: ${lead.nextFollowUpAt ? lead.nextFollowUpAt.toLocaleString('en-IN') : 'Not scheduled'}`,
      `Open lead: ${leadUrl}`
    ].join('\n')
  });
}

async function recordLeadCreation({ lead, actorUser, assignedCounsellor, note }) {
  await LeadActivity.create({
    lead: lead._id,
    type: 'lead_created',
    title: lead.leadType === 'automation' ? 'Ad lead received' : 'Lead created',
    note: note || `Lead came from ${lead.source}.`,
    counsellor: assignedCounsellor?.user?._id || actorUser?._id || null,
    doneBy: actorUser?._id || null,
    newStatus: lead.status
  });

  if (lead.assignedTo) {
    await LeadActivity.create({
      lead: lead._id,
      type: 'assigned',
      title: 'Auto-assigned to counsellor',
      note: `Assigned to ${assignedCounsellor?.user?.name || 'counsellor'} using balanced workload.`,
      counsellor: assignedCounsellor?.user?._id || null,
      doneBy: actorUser?._id || null,
      newStatus: lead.status
    });
  }
}

async function createAutomatedLead(payload, options = {}) {
  const source = normalizeLeadSource(payload.source || payload.platform || payload.provider);
  const cleanPhone = String(payload.phone || payload.mobile || '').trim();
  if (!payload.name || !cleanPhone) {
    throw new Error('Lead name and phone are required.');
  }

  const duplicate = await Lead.findOne({ phone: cleanPhone }).select('_id name assignedTo status');
  if (duplicate) return { lead: duplicate, duplicate: true };

  const [courseDoc, assignedCounsellor] = await Promise.all([
    resolveCourse(payload.course || payload.interestedCourse),
    chooseBestCounsellor()
  ]);

  const followUpAt = payload.followUpDate
    ? new Date(payload.followUpDate)
    : nextBusinessFollowUpDate();

  const lead = await Lead.create({
    name: String(payload.name).trim(),
    phone: cleanPhone,
    email: String(payload.email || '').trim().toLowerCase(),
    interestedCourse: courseDoc ? courseDoc._id : null,
    notes: payload.notes || payload.message || '',
    source,
    leadType: 'automation',
    category: payload.category || 'warm',
    status: 'new',
    assignedTo: assignedCounsellor ? assignedCounsellor._id : null,
    nextFollowUpAt: followUpAt,
    createdBy: options.actorUser ? options.actorUser._id : null,
    ownershipHistory: assignedCounsellor ? [{
      counsellor: assignedCounsellor._id,
      assignedBy: options.actorUser ? options.actorUser._id : null,
      note: `Auto-assigned from ${source} lead using balanced workload.`
    }] : [],
    automation: {
      provider: payload.provider || source,
      externalLeadId: payload.externalLeadId || payload.id || '',
      campaignName: payload.campaignName || payload.campaign || '',
      formName: payload.formName || payload.form || '',
      adName: payload.adName || payload.ad || '',
      rawPayload: payload
    }
  });

  await recordLeadCreation({
    lead,
    actorUser: options.actorUser,
    assignedCounsellor,
    note: `Lead received from ${source}${payload.campaignName ? ` campaign "${payload.campaignName}"` : ''}.`
  });

  await Promise.all([
    notifyAdmins({ lead, assignedCounsellor, actorUser: options.actorUser, sourceLabel: source }),
    notifyAssignedCounsellor({ lead, assignedCounsellor, actorUser: options.actorUser })
  ]);

  return { lead, assignedCounsellor, duplicate: false };
}

module.exports = {
  OPEN_STATUSES,
  chooseBestCounsellor,
  createAutomatedLead,
  nextBusinessFollowUpDate,
  normalizeLeadSource,
  notifyAdmins,
  notifyAssignedCounsellor,
  recordLeadCreation,
  resolveCourse
};
