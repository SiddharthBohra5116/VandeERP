const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const Counsellor = require('../models/Counsellor');
const User = require('../models/User');
const { normalizeHeader, normalizePhone } = require('./csvParser');
const { normalizeLeadSource, resolveCourse } = require('./leadAutomation');
const { isValidLeadStatus } = require('./leadStatusOptions');

const aliases = {
  id: ['crm_lead_id', 'lead_id', 'crm_id'],
  name: ['name', 'full_name', 'lead_name', 'student_name'],
  phone: ['phone', 'mobile', 'contact', 'phone_number', 'mobile_number'],
  email: ['email', 'email_address', 'email_id'],
  course: ['course', 'interested_course', 'course_interest'],
  source: ['source', 'lead_source', 'platform'],
  status: ['status', 'lead_status', 'stage'],
  notes: ['notes', 'note', 'message', 'remarks'],
  counsellor: ['counsellor', 'assigned_to', 'counsellor_email'],
  followUp: ['follow_up_date', 'next_follow_up', 'next_follow_up_date'],
  defaultSimCode: ['sim_code', 'default_sim_code', 'sim']
};

const valueFor = (row, keys) => keys.map(key => row[key]).find(value => value !== undefined);

async function syncSheetRow(rawValues, actor = null) {
  const row = Object.fromEntries(Object.entries(rawValues || {}).map(([key, value]) => [normalizeHeader(key), String(value ?? '').trim()]));
  const crmId = valueFor(row, aliases.id);
  const phone = normalizePhone(valueFor(row, aliases.phone));
  let lead = /^[a-f\d]{24}$/i.test(crmId || '') ? await Lead.findById(crmId) : null;
  if (!lead && phone) lead = await Lead.findOne({ phone });

  const name = valueFor(row, aliases.name);
  if (!lead && (!name || !phone)) throw new Error('Name and phone are required for a new lead.');

  const courseValue = valueFor(row, aliases.course);
  const counsellorValue = valueFor(row, aliases.counsellor);
  const [course, counsellorUser] = await Promise.all([
    courseValue === undefined ? null : resolveCourse(courseValue),
    counsellorValue
      ? User.findOne({
          role: 'counsellor',
          $or: [
            { email: String(counsellorValue).toLowerCase() },
            { name: new RegExp(`^${String(counsellorValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          ]
        })
      : null
  ]);
  const assignedCounsellor = counsellorUser ? await Counsellor.findOne({ user: counsellorUser._id }) : null;
  const statusValue = valueFor(row, aliases.status);
  const status = statusValue && await isValidLeadStatus(statusValue) ? statusValue : (lead?.status || 'new');
  const followUpValue = valueFor(row, aliases.followUp);
  const defaultSimCode = valueFor(row, aliases.defaultSimCode);
  const followUp = followUpValue ? new Date(followUpValue) : null;

  if (!lead) {
    lead = await Lead.create({
      name,
      phone,
      email: valueFor(row, aliases.email) || '',
      interestedCourse: course?._id || null,
      source: normalizeLeadSource(valueFor(row, aliases.source)),
      status,
      notes: valueFor(row, aliases.notes) || '',
      assignedTo: assignedCounsellor?._id || null,
      nextFollowUpAt: followUp && !Number.isNaN(followUp.getTime()) ? followUp : null,
      defaultSimCode: String(defaultSimCode || '').trim().slice(0, 50),
      leadType: 'automation',
      createdBy: actor?._id || null,
      ownershipHistory: assignedCounsellor ? [{
        counsellor: assignedCounsellor._id,
        assignedBy: actor?._id || null,
        note: 'Assigned from Google Sheets sync.'
      }] : [],
      automation: { provider: 'other', externalLeadId: crmId || '', rawPayload: rawValues }
    });
    await LeadActivity.create({
      lead: lead._id,
      type: 'lead_created',
      title: 'Lead created from Google Sheets',
      note: 'Google Sheets row synced to CRM.',
      doneBy: actor?._id || null,
      newStatus: lead.status
    });
    return { lead, created: true };
  }

  const changes = {};
  if (name !== undefined && name) changes.name = name;
  if (phone) changes.phone = phone;
  if (valueFor(row, aliases.email) !== undefined) changes.email = valueFor(row, aliases.email).toLowerCase();
  if (courseValue !== undefined) changes.interestedCourse = course?._id || null;
  if (valueFor(row, aliases.source) !== undefined) changes.source = normalizeLeadSource(valueFor(row, aliases.source));
  if (statusValue !== undefined) changes.status = status;
  if (valueFor(row, aliases.notes) !== undefined) changes.notes = valueFor(row, aliases.notes);
  if (counsellorValue !== undefined) changes.assignedTo = assignedCounsellor?._id || null;
  if (followUpValue !== undefined) changes.nextFollowUpAt = followUp && !Number.isNaN(followUp.getTime()) ? followUp : null;
  if (defaultSimCode !== undefined) changes.defaultSimCode = String(defaultSimCode).trim().slice(0, 50);

  const changedFields = Object.keys(changes).filter(key => String(lead[key] ?? '') !== String(changes[key] ?? ''));
  if (changedFields.length) {
    Object.assign(lead, changes);
    await lead.save();
    await LeadActivity.create({
      lead: lead._id,
      type: 'note',
      title: 'Lead updated from Google Sheets',
      note: `Updated: ${changedFields.join(', ')}.`,
      doneBy: actor?._id || null,
      metadata: { changedFields }
    });
  }
  return { lead, created: false, changedFields };
}

module.exports = { aliases, syncSheetRow };
