const LeadStatus = require('../models/LeadStatus');
const { LEAD_STATUSES } = require('../config/constants');

const DEFAULT_STATUS_META = {
  new: { label: 'New', badgeClass: 'badge-orange', sortOrder: 10 },
  contacted: { label: 'Contacted', badgeClass: 'badge-blue', sortOrder: 20 },
  mentorship_scheduled: { label: 'Mentorship Scheduled', badgeClass: 'badge-blue', sortOrder: 30 },
  mentorship_attended: { label: 'Mentorship Attended', badgeClass: 'badge-yellow', sortOrder: 40 },
  follow_up: { label: 'Follow Up', badgeClass: 'badge-yellow', sortOrder: 50 },
  joining_interested: { label: 'Joining Interested', badgeClass: 'badge-gold', sortOrder: 60 },
  admission_completed: { label: 'Admission Completed', badgeClass: 'badge-green', isClosed: true, sortOrder: 70 },
  lost: { label: 'Lost', badgeClass: 'badge-red', isClosed: true, sortOrder: 80 }
};

function slugifyStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function labelFromKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

async function ensureDefaultLeadStatuses() {
  const existingStatuses = await LeadStatus.countDocuments();
  if (existingStatuses > 0) return;

  await Promise.all(LEAD_STATUSES.map((key, index) => {
    const meta = DEFAULT_STATUS_META[key] || {};
    return LeadStatus.updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          label: meta.label || labelFromKey(key),
          badgeClass: meta.badgeClass || 'badge-grey',
          isClosed: Boolean(meta.isClosed),
          isSystem: true,
          sortOrder: meta.sortOrder || ((index + 1) * 10)
        }
      },
      { upsert: true }
    );
  }));
}

async function getLeadStatuses() {
  await ensureDefaultLeadStatuses();
  return LeadStatus.find({ isDeleted: { $ne: true } }).sort({ sortOrder: 1, label: 1 });
}

async function getClosedLeadStatusKeys() {
  const statuses = await getLeadStatuses();
  return statuses.filter(status => status.isClosed).map(status => status.key);
}

async function getOpenLeadStatusKeys() {
  const statuses = await getLeadStatuses();
  return statuses.filter(status => !status.isClosed).map(status => status.key);
}

async function isValidLeadStatus(statusKey) {
  const key = slugifyStatus(statusKey);
  if (!key) return false;
  await ensureDefaultLeadStatuses();
  return Boolean(await LeadStatus.exists({ key, isDeleted: { $ne: true } }));
}

const ALLOWED_BADGE_CLASSES = [
  'badge-grey',
  'badge-blue',
  'badge-yellow',
  'badge-orange',
  'badge-green',
  'badge-red',
  'badge-gold'
];

function normalizeBadgeClass(value, fallback = 'badge-grey') {
  return ALLOWED_BADGE_CLASSES.includes(value) ? value : fallback;
}

async function findOrCreateLeadStatus(value, options = {}) {
  const raw = String(value || '').trim();
  const key = slugifyStatus(raw);
  if (!key) return null;

  await ensureDefaultLeadStatuses();
  const existing = await LeadStatus.findOne({ key });
  if (existing) {
    if (existing.isDeleted) {
      existing.isDeleted = false;
      existing.deletedAt = null;
      existing.isSystem = false;
      existing.label = raw || labelFromKey(key);
    }
    if (options.badgeClass || options.isClosed !== undefined) {
      existing.badgeClass = normalizeBadgeClass(options.badgeClass, existing.badgeClass);
      if (options.isClosed !== undefined) existing.isClosed = Boolean(options.isClosed);
      await existing.save();
    }
    return existing;
  }

  const count = await LeadStatus.countDocuments({ isDeleted: { $ne: true } });
  
  // Smart auto-detect closed pipeline status based on common keywords
  const lowerRaw = raw.toLowerCase();
  const isClosed = lowerRaw.includes('lost') || 
                   lowerRaw.includes('admit') || 
                   lowerRaw.includes('convert') || 
                   lowerRaw.includes('close') || 
                   lowerRaw.includes('drop') ||
                   lowerRaw.includes('reject') ||
                   lowerRaw.includes('complete');

  // Smart auto-detect badge color based on common keywords.
  let badgeClass = 'badge-grey';
  if (lowerRaw.includes('new')) badgeClass = 'badge-orange';
  else if (lowerRaw.includes('contact') || lowerRaw.includes('call')) badgeClass = 'badge-blue';
  else if (lowerRaw.includes('schedule') || lowerRaw.includes('attend') || lowerRaw.includes('follow')) badgeClass = 'badge-yellow';
  else if (lowerRaw.includes('interest')) badgeClass = 'badge-gold';
  else if (lowerRaw.includes('admit') || lowerRaw.includes('convert') || lowerRaw.includes('success') || lowerRaw.includes('complete')) badgeClass = 'badge-green';
  else if (lowerRaw.includes('lost') || lowerRaw.includes('reject') || lowerRaw.includes('drop') || lowerRaw.includes('close')) badgeClass = 'badge-red';

  return LeadStatus.create({
    key,
    label: raw || labelFromKey(key),
    badgeClass: normalizeBadgeClass(options.badgeClass, badgeClass),
    isClosed: options.isClosed !== undefined ? Boolean(options.isClosed) : isClosed,
    sortOrder: (count + 1) * 10
  });
}

function statusLabelMap(statuses) {
  return (statuses || []).reduce((map, status) => {
    map[status.key] = status.label;
    return map;
  }, {});
}

function statusBadgeMap(statuses) {
  return (statuses || []).reduce((map, status) => {
    map[status.key] = status.badgeClass || 'badge-grey';
    return map;
  }, {});
}

module.exports = {
  DEFAULT_STATUS_META,
  ALLOWED_BADGE_CLASSES,
  ensureDefaultLeadStatuses,
  findOrCreateLeadStatus,
  getClosedLeadStatusKeys,
  getLeadStatuses,
  getOpenLeadStatusKeys,
  isValidLeadStatus,
  labelFromKey,
  normalizeBadgeClass,
  slugifyStatus,
  statusBadgeMap,
  statusLabelMap
};
