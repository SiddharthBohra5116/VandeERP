const User = require('../../models/User');
const Student = require('../../models/Student');
const Course = require('../../models/Course');
const Batch = require('../../models/Batch');
const Lead = require('../../models/Lead');
const LeadStatus = require('../../models/LeadStatus');
const LeadActivity = require('../../models/LeadActivity');
const Fee = require('../../models/Fee');
const Message = require('../../models/Message');
const Counsellor = require('../../models/Counsellor');

const fs = require('fs');
const path = require('path');
const { LEAD_SOURCES } = require('../../config/constants');
const { escapeRegex } = require('../../utils/sanitize');
const { parseCsv } = require('../../utils/csvParser');
const { computeSourceStats } = require('../../utils/leadAnalytics');
const {
  ALLOWED_BADGE_CLASSES,
  findOrCreateLeadStatus,
  getLeadStatuses,
  normalizeBadgeClass,
  slugifyStatus
} = require('../../utils/leadStatusOptions');
const logger = require('../../utils/logger');

// Shared CSV header mappings constants
const NAME_KEYS = ['name', 'full_name', 'lead', 'customer', 'student_name', 'candidate_name', 'client_name', 'prospect_name', 'prospect'];
const PHONE_KEYS = ['phone', 'mobile', 'phone_number', 'contact_no', 'contact_number', 'mobile_number', 'phone_no', 'mobile_no', 'mob', 'contact', 'telephone'];
const EMAIL_KEYS = ['email', 'email_address', 'email_id', 'mail', 'mail_id', 'emailid'];
const COURSE_KEYS = ['course', 'interestedcourse', 'interested_course', 'program', 'class', 'course_interest', 'course_name', 'interested_course_name'];
const COUNSELLOR_KEYS = ['counsellor', 'assignedto', 'assigned_to', 'owner', 'counsellor_name', 'counsellor_email', 'assigned_counsellor', 'counsellor_assigned'];
const STATUS_KEYS = ['status', 'lead_status', 'stage', 'lead_stage', 'pipeline_status', 'current_status', 'status_label'];
const SOURCE_KEYS = ['source', 'lead_source', 'platform', 'campaign'];
const FOLLOWUP_KEYS = [
  'followup', 'follow_up', 'nextfollowup', 'next_follow_up', 'follow_up_date',
  'call_follow_up_date', 'next_follow_up_date_and_time', 'next_follow_up_date',
  'follow_up_date_and_time', 'follow_up_at', 'next_followup_date'
];

const KNOWN_KEYS = new Set([
  ...NAME_KEYS,
  ...PHONE_KEYS,
  ...EMAIL_KEYS,
  ...COURSE_KEYS,
  ...COUNSELLOR_KEYS,
  ...STATUS_KEYS,
  ...SOURCE_KEYS,
  ...FOLLOWUP_KEYS,
  's_no', 's_no_', 'sno', 'sr_no', 'serial_number'
]);

async function resolveCourse(courseValue, fallbackCourseId = null) {
  if (courseValue && courseValue.match && courseValue.match(/^[0-9a-fA-F]{24}$/)) {
    return await Course.findById(courseValue);
  }

  if (courseValue) {
    const course = await Course.findOne({
      $or: [
        { name: new RegExp('^' + escapeRegex(String(courseValue).trim()) + '$', 'i') },
        { code: String(courseValue).trim().toUpperCase() }
      ]
    });

    if (course) return course;
  }

  if (fallbackCourseId) {
    return await Course.findById(fallbackCourseId);
  }

  return null;
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function buildImportNotes(row) {
  const preferredNotes = [];
  const customNotes = [];

  const preferredKeys = [
    'notes', 'note', 'comment', 'comments', 'call_follow_up', 'wa_follow_up', 'comment_21_april',
    'coming_mentroship', 'coming_mentorship', 'prefarable_day', 'preferable_day', 'confrimations',
    'confirmations', 'text_message', 'notes_workshop_status', 'what_are_you_currently_doing',
    'why_do_you_want_to_learn_video_editing', 'can_you_attend_a_2_hour_offline_workshop_in_jodhpur',
    'do_you_have_access_to_a_laptop_pc'
  ];

  for (const key of preferredKeys) {
    const value = row[key];
    if (value && String(value).trim()) {
      preferredNotes.push(`${key.replace(/_/g, ' ')}: ${String(value).trim()}`);
    }
  }

  for (const key of Object.keys(row)) {
    if (KNOWN_KEYS.has(key) || preferredKeys.includes(key)) continue;
    const value = row[key];
    if (value && String(value).trim()) {
      customNotes.push(`${key.replace(/_/g, ' ')}: ${String(value).trim()}`);
    }
  }

  return [...preferredNotes, ...customNotes].join(' | ');
}

exports.getLeads = async (req, res) => {
  try {
    const { status, course, source, search } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 10), 100);
    const skip = (page - 1) * limit;

    const filter = {};

    if (status) filter.status = status;
    if (source) filter.source = source;

    if (course) {
      const courseDoc = await resolveCourse(course);
      if (courseDoc) filter.interestedCourse = courseDoc._id;
    }

    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ];
    }

    const [leads, totalLeads, leadStatuses] = await Promise.all([
      Lead.find(filter)
        .populate({ path: 'assignedTo', populate: { path: 'user', select: 'name email phone' } })
        .populate('interestedCourse', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(filter),
      getLeadStatuses()
    ]);

    const Counsellor = require('../../models/Counsellor');
    const counsellorProfiles = await Counsellor.find().populate('user', 'name email phone status');
    const counsellors = counsellorProfiles
      .filter(p => p.user && p.user.status === 'active')
      .map(p => ({
        _id: p._id,
        name: p.user.name,
        email: p.user.email,
        phone: p.user.phone
      }));

    const courses = await Course.find({ isActive: true }).select('name code');

    const allLeadsAnalytics = await Lead.find({}).populate('interestedCourse', 'name code');
    const sourceStatsMap = computeSourceStats(allLeadsAnalytics);

    res.render('admin/leads', {
      title: 'Leads',
      user: req.user,
      leads,
      counsellors,
      courses,
      leadStatuses,
      sourceStats: sourceStatsMap,
      pagination: {
        page,
        limit,
        total: totalLeads,
        pages: Math.max(Math.ceil(totalLeads / limit), 1)
      },
      filter: req.query
    });

  } catch (err) {
    logger.error('getLeads Error', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};

exports.postImportLeads = async (req, res) => {
  const redirectBase = '/admin/leads';

  try {
    if (!req.file) {
      return res.redirect(`${redirectBase}?error=${encodeURIComponent('Please choose a CSV file to import.')}`);
    }

    const allowedExtensions = ['.csv', '.tsv', '.txt'];
    const ext = path.extname(req.file.originalname || '').toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.redirect(`${redirectBase}?error=${encodeURIComponent('Import file must be a CSV, TSV, or TXT file.')}`);
    }

    const csvText = await fs.promises.readFile(req.file.path, 'utf8');
    if (!csvText.trim()) {
      if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.redirect(`${redirectBase}?error=${encodeURIComponent('Import file is empty.')}`);
    }

    const rows = parseCsv(csvText);
    
    if (!rows.length) {
      if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.redirect(`${redirectBase}?error=${encodeURIComponent('CSV file has no data rows.')}`);
    }

    const counsellorProfiles = await Counsellor.find().populate('user', 'name email phone status');
    const counsellorsByEmail = new Map();
    const counsellorsByName = new Map();
    counsellorProfiles.forEach(profile => {
      if (!profile.user) return;
      counsellorsByEmail.set(String(profile.user.email || '').toLowerCase().trim(), profile);
      counsellorsByName.set(String(profile.user.name || '').toLowerCase().trim(), profile);
    });

    const isRowBlank = (r) => {
      return Object.values(r).every(val => !val || String(val).trim() === '');
    };

    const isPlaceholderPhone = (val) => {
      const clean = String(val || '').trim().toLowerCase();
      return !clean || ['n/a', 'na', 'nil', '-', 'no', 'none', 'null', 'undefined'].includes(clean);
    };

    // ==========================================
    // Pre-load existing leads for in-memory O(1) duplicate checks
    // ==========================================
    const candidatePhones = [];
    const candidateSuffixes = [];
    const candidateEmails = [];

    for (const row of rows) {
      if (isRowBlank(row)) continue;

      const phone = firstValue(row, PHONE_KEYS);
      const email = firstValue(row, EMAIL_KEYS);

      const normalizedPhone = String(phone || '').trim();
      const emailCheckVal = String(email || '').trim().toLowerCase();

      if (!isPlaceholderPhone(normalizedPhone)) {
        const cleanPhone = normalizedPhone.replace(/\D/g, '');
        candidatePhones.push(normalizedPhone);
        if (cleanPhone) {
          candidatePhones.push(cleanPhone);
          if (cleanPhone.length >= 10) {
            candidateSuffixes.push(cleanPhone.slice(-10));
          }
        }
      }

      if (emailCheckVal && emailCheckVal.includes('@')) {
        candidateEmails.push(emailCheckVal);
      }
    }

    const existingLeads = await Lead.find({
      $or: [
        { phone: { $in: candidatePhones } },
        ...(candidateEmails.length ? [{ email: { $in: candidateEmails } }] : []),
        ...(candidateSuffixes.length ? candidateSuffixes.map(suff => ({ phone: new RegExp(escapeRegex(suff) + '$') })) : [])
      ]
    }).select('phone email');

    const existingPhonesSet = new Set();
    const existingEmailsSet = new Set();

    for (const lead of existingLeads) {
      if (lead.phone) {
        existingPhonesSet.add(lead.phone);
        const clean = lead.phone.replace(/\D/g, '');
        if (clean) {
          existingPhonesSet.add(clean);
          if (clean.length >= 10) {
            existingPhonesSet.add(clean.slice(-10));
          }
        }
      }
      if (lead.email) {
        existingEmailsSet.add(lead.email.toLowerCase().trim());
      }
    }

    // ==========================================
    // PASS 1: Strict File Validation
    // ==========================================
    const seenPhonesInCsv = new Map();
    const seenEmailsInCsv = new Map();
    const duplicateRowIndexes = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // 1-based index, plus 1 for header row

      if (isRowBlank(row)) continue;

      const name = firstValue(row, NAME_KEYS);
      const phone = firstValue(row, PHONE_KEYS);
      const email = firstValue(row, EMAIL_KEYS);

      let normalizedPhone = String(phone || '').trim();
      let normalizedEmail = String(email || '').trim().toLowerCase();

      // 1. Ensure at least one contact channel exists
      if (isPlaceholderPhone(normalizedPhone) && !normalizedEmail) {
        if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
        return res.redirect(`${redirectBase}?error=${encodeURIComponent(`Row ${rowIndex}: Contact details are missing. Every lead must have a phone number or an email address.`)}`);
      }

      // 2. Email format validation (if provided)
      if (normalizedEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
          if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
          return res.redirect(`${redirectBase}?error=${encodeURIComponent(`Row ${rowIndex}: Invalid email address format "${email}". Please correct it.`)}`);
        }
      }

      // 3. Prevent duplicate contact details within the CSV file itself
      if (!isPlaceholderPhone(normalizedPhone)) {
        const cleanPhone = normalizedPhone.replace(/\D/g, '');
        if (cleanPhone && cleanPhone.length >= 10) {
          const suffix = cleanPhone.slice(-10);
          if (seenPhonesInCsv.has(suffix)) {
            duplicateRowIndexes.add(i);
          } else {
            seenPhonesInCsv.set(suffix, i);
          }
        } else {
          if (seenPhonesInCsv.has(normalizedPhone)) {
            duplicateRowIndexes.add(i);
          } else {
            seenPhonesInCsv.set(normalizedPhone, i);
          }
        }
      }

      if (normalizedEmail) {
        if (seenEmailsInCsv.has(normalizedEmail)) {
          duplicateRowIndexes.add(i);
        } else {
          seenEmailsInCsv.set(normalizedEmail, i);
        }
      }

      if (duplicateRowIndexes.has(i)) continue;

      // 4. Validate Course exists (if specified)
      const courseValue = firstValue(row, COURSE_KEYS);
      if (courseValue) {
        const course = await resolveCourse(courseValue);
        if (!course) {
          if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
          return res.redirect(`${redirectBase}?error=${encodeURIComponent(`Row ${rowIndex}: Course "${courseValue}" was not found in the system. Check spelling or create it first.`)}`);
        }
      }

      // 5. Validate Counsellor spelling/existence (if specified)
      const counsellorLookup = String(firstValue(row, COUNSELLOR_KEYS) || '').toLowerCase().trim();
      if (counsellorLookup) {
        let matchedCounsellor = counsellorsByEmail.get(counsellorLookup) || counsellorsByName.get(counsellorLookup);
        if (!matchedCounsellor) {
          for (const [nameKey, profile] of counsellorsByName.entries()) {
            if (nameKey.includes(counsellorLookup) || counsellorLookup.includes(nameKey)) {
              matchedCounsellor = profile;
              break;
            }
          }
        }
        if (!matchedCounsellor) {
          if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
          return res.redirect(`${redirectBase}?error=${encodeURIComponent(`Row ${rowIndex}: Counsellor assignment "${counsellorLookup}" does not match any registered counsellor.`)}`);
        }
      }
    }

    // ==========================================
    // PASS 2: Safe Database Insertion
    // ==========================================
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (isRowBlank(row)) continue;

      if (duplicateRowIndexes.has(i)) {
        skipped += 1;
        continue;
      }

      try {
        const name = firstValue(row, NAME_KEYS);
        const phone = firstValue(row, PHONE_KEYS);

        let normalizedName = String(name || '').trim();
        let normalizedPhone = String(phone || '').trim();

        if (isPlaceholderPhone(normalizedPhone)) {
          const emailVal = String(firstValue(row, EMAIL_KEYS) || '').trim();
          if (emailVal) {
            normalizedPhone = emailVal;
            if (!normalizedName) normalizedName = emailVal.split('@')[0];
          }
        }

        if (!normalizedName) {
          normalizedName = `Lead (${normalizedPhone})`;
        }

        // Database duplicate lookup (in-memory Set checks)
        const emailCheckVal = String(firstValue(row, EMAIL_KEYS) || '').trim().toLowerCase();
        
        let isDuplicate = false;
        if (!isPlaceholderPhone(normalizedPhone)) {
          const cleanPhone = normalizedPhone.replace(/\D/g, '');
          if (existingPhonesSet.has(normalizedPhone)) {
            isDuplicate = true;
          } else if (cleanPhone && existingPhonesSet.has(cleanPhone)) {
            isDuplicate = true;
          } else if (cleanPhone && cleanPhone.length >= 10 && existingPhonesSet.has(cleanPhone.slice(-10))) {
            isDuplicate = true;
          }
        }
        
        if (!isDuplicate && emailCheckVal && existingEmailsSet.has(emailCheckVal)) {
          isDuplicate = true;
        }

        if (isDuplicate) {
          skipped += 1;
          continue;
        }

        const courseValue = firstValue(row, COURSE_KEYS);
        const statusValue = firstValue(row, STATUS_KEYS);
        const sourceValue = firstValue(row, SOURCE_KEYS);
        const followUpValue = firstValue(row, FOLLOWUP_KEYS);
        const counsellorLookup = String(firstValue(row, COUNSELLOR_KEYS) || '').toLowerCase().trim();

        const course = await resolveCourse(courseValue);
        const statusDoc = await findOrCreateLeadStatus(statusValue || 'new');

        let assignedCounsellor = null;
        if (counsellorLookup) {
          if (counsellorsByEmail.has(counsellorLookup)) {
            assignedCounsellor = counsellorsByEmail.get(counsellorLookup);
          } else if (counsellorsByName.has(counsellorLookup)) {
            assignedCounsellor = counsellorsByName.get(counsellorLookup);
          } else {
            for (const [nameKey, profile] of counsellorsByName.entries()) {
              if (nameKey.includes(counsellorLookup) || counsellorLookup.includes(nameKey)) {
                assignedCounsellor = profile;
                break;
              }
            }
          }
        }

        const rawSource = String(sourceValue || '').trim().toLowerCase();
        const matchedSource = LEAD_SOURCES.find(s => s.toLowerCase() === rawSource) || 'Other';

        let nextFollowUpDate = null;
        if (followUpValue) {
          const parsedDate = new Date(followUpValue);
          if (!isNaN(parsedDate.getTime())) {
            nextFollowUpDate = parsedDate;
          }
        }

        const lead = await Lead.create({
          name: normalizedName,
          phone: normalizedPhone,
          email: emailCheckVal,
          interestedCourse: course ? course._id : null,
          source: matchedSource,
          status: statusDoc ? statusDoc.key : 'new',
          notes: buildImportNotes(row),
          assignedTo: assignedCounsellor ? assignedCounsellor._id : null,
          nextFollowUpAt: nextFollowUpDate,
          createdBy: req.user._id,
          ownershipHistory: assignedCounsellor ? [{
            counsellor: assignedCounsellor._id,
            assignedBy: req.user._id,
            note: 'Lead assigned during CSV import.'
          }] : []
        });

        // Add newly created lead data to in-memory sets to catch dynamic same-batch duplicates
        if (lead.phone) {
          existingPhonesSet.add(lead.phone);
          const clean = lead.phone.replace(/\D/g, '');
          if (clean) {
            existingPhonesSet.add(clean);
            if (clean.length >= 10) {
              existingPhonesSet.add(clean.slice(-10));
            }
          }
        }
        if (lead.email) {
          existingEmailsSet.add(lead.email.toLowerCase().trim());
        }

        await LeadActivity.create({
          lead: lead._id,
          type: 'lead_created',
          title: 'Lead imported from CSV',
          note: `Imported by admin from ${req.file.originalname}.`,
          counsellor: assignedCounsellor ? assignedCounsellor._id : null,
          doneBy: req.user._id,
          newStatus: lead.status
        });

        created += 1;
      } catch (rowErr) {
        failed += 1;
        logger.warn('Lead CSV row import failed', { err: rowErr.message, row });
      }
    }

    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
    res.redirect(`${redirectBase}?imported=${created}&skipped=${skipped}&failed=${failed}`);
  } catch (err) {
    logger.error('Lead CSV Import Error', { err: err.message, stack: err.stack });
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
    res.redirect(`${redirectBase}?error=${encodeURIComponent(err.message)}`);
  }
};

exports.postCreateStatus = async (req, res) => {
  try {
    const label = String(req.body.label || '').trim();
    if (!label) return res.redirect('/admin/leads?error=Status+label+is+required');
    if (label.length > 50) return res.redirect('/admin/leads?error=Status+label+must+be+50+characters+or+less');

    const key = slugifyStatus(label);
    if (!key) return res.redirect('/admin/leads?error=Status+label+needs+letters+or+numbers');

    if (req.body.badgeClass && !ALLOWED_BADGE_CLASSES.includes(req.body.badgeClass)) {
      return res.redirect('/admin/leads?error=Invalid+status+color');
    }

    const badgeClass = normalizeBadgeClass(req.body.badgeClass);
    const isClosed = req.body.isClosed === 'on' || req.body.isClosed === 'true';
    const statusDoc = await findOrCreateLeadStatus(label, { badgeClass, isClosed });
    if (!statusDoc) return res.redirect('/admin/leads?error=Failed+to+create+status');

    res.redirect('/admin/leads?statusCreated=1');
  } catch (err) {
    logger.error('Create Lead Status Error', { err: err.message });
    res.redirect(`/admin/leads?error=${encodeURIComponent(err.message)}`);
  }
};

exports.postDeleteStatus = async (req, res) => {
  try {
    const status = await LeadStatus.findById(req.params.id);
    if (!status) return res.redirect('/admin/leads?error=Status+not+found');

    status.isDeleted = true;
    status.deletedAt = new Date();
    await status.save();
    res.redirect('/admin/leads?statusDeleted=1');
  } catch (err) {
    logger.error('Delete Lead Status Error', { err: err.message });
    res.redirect(`/admin/leads?error=${encodeURIComponent(err.message)}`);
  }
};

exports.getLeadDetail = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate({ path: 'assignedTo', populate: { path: 'user', select: 'name email phone' } })
      .populate('interestedCourse', 'name code durationMonths fees')
      .populate('followUpHistory.doneBy', 'name role')
      .populate('createdBy', 'name role')
      .populate({ path: 'ownershipHistory.counsellor', populate: { path: 'user', select: 'name email phone' } })
      .populate('ownershipHistory.assignedBy', 'name role')
      .populate({
        path: 'convertedStudent',
        populate: [
          { path: 'user', select: 'name email phone status' },
          { path: 'course', select: 'name code' },
          { path: 'batch', select: 'name' }
        ]
      });

    if (!lead) return res.redirect('/admin/leads');

    const leadActivities = await LeadActivity.find({ lead: lead._id })
      .populate('doneBy', 'name role')
      .populate('counsellor', 'name role')
      .sort({ createdAt: -1 });

    const Counsellor = require('../../models/Counsellor');
    const counsellorProfiles = await Counsellor.find().populate('user', 'name email phone status');
    const counsellors = counsellorProfiles
      .filter(p => p.user && p.user.status === 'active')
      .map(p => ({
        _id: p._id,
        name: p.user.name,
        email: p.user.email,
        phone: p.user.phone
      }));

    const leadStatuses = await getLeadStatuses();

    res.render('admin/lead-detail', {
      title: lead.name,
      user: req.user,
      lead,
      leadActivities,
      counsellors,
      leadStatuses,
      error: req.query.error
    });

  } catch (err) {
    logger.error('Admin Lead Details Fetch Error', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};

exports.postAssignLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate({
      path: 'assignedTo',
      populate: { path: 'user', select: '_id name status' }
    });
    if (!lead) return res.redirect('/admin/leads');

    const oldCounsellor = lead.assignedTo;
    const oldCounsellorId = oldCounsellor?._id || oldCounsellor || null;
    const assignedTo = req.body.counsellorId || null;

    lead.assignedTo = assignedTo;

    if (assignedTo) {
      lead.ownershipHistory.push({
        counsellor: assignedTo,
        assignedBy: req.user._id,
        note: oldCounsellor ? 'Lead reassigned by admin' : 'Lead assigned by admin'
      });
    }

    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      type: oldCounsellor ? 'reassigned' : 'assigned',
      title: oldCounsellor ? 'Lead Reassigned' : 'Lead Assigned',
      note: assignedTo
        ? `Lead assigned by admin${oldCounsellor ? ` from ${oldCounsellor.user?.name || 'previous counsellor'}` : ''}.`
        : `Lead unassigned by admin${oldCounsellor ? ` from ${oldCounsellor.user?.name || 'previous counsellor'}` : ''}.`,
      counsellor: assignedTo || oldCounsellorId || null,
      doneBy: req.user._id
    });

    if (oldCounsellor?.user && (!assignedTo || String(oldCounsellorId) !== String(assignedTo)) && oldCounsellor.user.status === 'active') {
      await Message.create({
        sender: req.user._id,
        recipient: oldCounsellor.user._id,
        content: `Lead reassigned away: "${lead.name}".\nThis lead is no longer in your active pipeline.`
      });
    }

    if (assignedTo) {
      const counsellor = await Counsellor.findById(assignedTo).populate('user', '_id status');
      if (counsellor?.user && counsellor.user.status === 'active') {
        await Message.create({
          sender: req.user._id,
          recipient: counsellor.user._id,
          content: `${oldCounsellor ? 'Lead reassigned to you' : 'New lead assigned'}: "${lead.name}".\nOpen lead: /counsellor/leads/${lead._id}`
        });
      }
    }

    logger.info('Lead assigned successfully', {
      leadId: lead._id,
      counsellorId: assignedTo
    });

    res.redirect(req.header('Referer') || '/admin/leads');

  } catch (err) {
    logger.error('postAssignLead Error', {
      err: err.message,
      stack: err.stack
    });

    const redirectUrl = req.header('Referer') || '/admin/leads';
    const cleanUrl = redirectUrl.split('?')[0];

    res.redirect(`${cleanUrl}?error=${encodeURIComponent(err.message)}`);
  }
};

exports.getConvertLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('interestedCourse', 'name code durationMonths fees');

    if (!lead) return res.redirect('/admin/leads');

    const Teacher = require('../../models/Teacher');
    const [batches, teacherProfiles, courses] = await Promise.all([
      Batch.find({ isActive: true })
        .populate('course', 'name code fees durationMonths')
        .populate('teachers', 'name email status')
        .sort({ name: 1 }),
      Teacher.find().populate('user', 'name email status'),
      Course.find({ isActive: true }).select('name code fees durationMonths').sort({ name: 1 })
    ]);

    const teacherProfileByUserId = new Map(
      teacherProfiles
        .filter(profile => profile.user)
        .map(profile => [profile.user._id.toString(), profile])
    );

    const teachers = teacherProfiles
      .filter(p => p.user && p.user.status === 'active')
      .map(p => ({
        _id: p._id,
        userId: p.user._id,
        name: p.user.name,
        email: p.user.email,
        courseIds: (p.courses || []).map(id => id.toString())
      }));

    const batchOptions = batches.map(batch => {
      const firstTeacherUser = (batch.teachers || []).find(t => t && t.status === 'active') || (batch.teachers || [])[0];
      const firstTeacherProfile = firstTeacherUser
        ? teacherProfileByUserId.get(firstTeacherUser._id.toString())
        : null;
      const teacherProfileIds = (batch.teachers || [])
        .map(teacherUser => teacherUser ? teacherProfileByUserId.get(teacherUser._id.toString()) : null)
        .filter(Boolean)
        .map(profile => profile._id.toString());

      return {
        _id: batch._id.toString(),
        name: batch.name,
        courseId: batch.course?._id?.toString() || '',
        courseName: batch.course?.name || '',
        capacity: batch.capacity || 0,
        teacherProfileId: firstTeacherProfile?._id?.toString() || '',
        teacherProfileIds,
        teacherName: firstTeacherProfile?.user?.name || firstTeacherUser?.name || ''
      };
    });

    res.render('admin/convert', {
      title: `Convert: ${lead.name}`,
      user: req.user,
      lead,
      batches: batchOptions,
      teachers,
      courses
    });

  } catch (err) {
    logger.error('Admin Get Convert Lead Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect(`/admin/leads/${req.params.id}?error=1`);
  }
};

exports.postConvertLead = async (req, res) => {
  logger.info('Convert lead request received', {
    leadId: req.params.id
  });

  let lead;
  let studentUser;
  let studentProfile;

  try {
    lead = await Lead.findById(req.params.id).populate('interestedCourse');
    if (!lead) return res.redirect('/admin/leads');

    const Teacher = require('../../models/Teacher');
    const [batches, teacherProfiles, courses] = await Promise.all([
      Batch.find({ isActive: true })
        .populate('course', 'name code fees durationMonths')
        .populate('teachers', 'name email status')
        .sort({ name: 1 }),
      Teacher.find().populate('user', 'name email status'),
      Course.find({ isActive: true }).select('name code fees durationMonths').sort({ name: 1 })
    ]);

    const teachers = teacherProfiles
      .filter(p => p.user && p.user.status === 'active')
      .map(p => ({
        _id: p._id,
        name: p.user.name,
        email: p.user.email
      }));

    const teacherProfileByUserId = new Map(
      teacherProfiles
        .filter(profile => profile.user)
        .map(profile => [profile.user._id.toString(), profile])
    );

    const batchOptions = batches.map(batch => {
      const linkedProfiles = (batch.teachers || [])
        .map(teacherUser => teacherUser ? teacherProfileByUserId.get(teacherUser._id.toString()) : null)
        .filter(Boolean);
      const firstTeacherProfile = linkedProfiles[0] || null;

      return {
        _id: batch._id.toString(),
        name: batch.name,
        courseId: batch.course?._id?.toString() || '',
        courseName: batch.course?.name || '',
        capacity: batch.capacity || 0,
        teacherProfileId: firstTeacherProfile?._id?.toString() || '',
        teacherProfileIds: linkedProfiles.map(profile => profile._id.toString()),
        teacherName: firstTeacherProfile?.user?.name || ''
      };
    });

    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password ? req.body.password.trim() : '';

    if (!email || !email.includes('@')) {
      return res.render('admin/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches: batchOptions,
        teachers,
        courses,
        error: 'A valid student email address is required.'
      });
    }

    if (!password || password.length < 8) {
      return res.render('admin/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches: batchOptions,
        teachers,
        courses,
        error: 'Password must be at least 8 characters long.'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('admin/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches: batchOptions,
        teachers,
        courses,
        error: 'This email address is already registered.'
      });
    }

    const selectedCourse = await resolveCourse(
      req.body.course,
      lead.interestedCourse?._id || lead.interestedCourse
    );

    if (!selectedCourse) {
      return res.render('admin/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches: batchOptions,
        teachers,
        courses,
        error: 'Please select a valid course.'
      });
    }

    const totalFees = Number(req.body.fees_total) || selectedCourse.fees || 0;
    const paidFees = Number(req.body.fees_paid) || 0;

    let targetBatch = null;
    let batchName = '';

    if (req.body.batch && req.body.batch.match && req.body.batch.match(/^[0-9a-fA-F]{24}$/)) {
      targetBatch = await Batch.findById(req.body.batch).populate('course', 'name code fees durationMonths');
      batchName = targetBatch ? targetBatch.name : '';
    } else if (req.body.customBatch && req.body.customBatch.trim()) {
      batchName = req.body.customBatch.trim();
    } else if (req.body.batch && req.body.batch.trim()) {
      batchName = req.body.batch.trim();
    }

    if (!batchName) {
      return res.render('admin/convert', {
        title: `Convert: ${lead.name}`,
        user: req.user,
        lead,
        batches: batchOptions,
        teachers,
        courses,
        error: 'Batch selection or custom batch name is required.'
      });
    }

    if (!targetBatch) {
      targetBatch = await Batch.findOne({ name: batchName });
    }

    const selectedTeacherProfile = req.body.teacherId
      ? await Teacher.findById(req.body.teacherId).populate('user', '_id name')
      : null;
    const selectedTeacherUserId = selectedTeacherProfile?.user?._id || null;

    if (!targetBatch) {
      targetBatch = await Batch.create({
        name: batchName,
        course: selectedCourse._id,
        capacity: 20,
        teachers: selectedTeacherUserId ? [selectedTeacherUserId] : [],
        isActive: true
      });

      logger.info('Dynamically created batch during lead conversion', {
        batchId: targetBatch._id,
        batchName
      });
    } else if (selectedTeacherUserId && !targetBatch.teachers.some(id => id.toString() === selectedTeacherUserId.toString())) {
      targetBatch.teachers.push(selectedTeacherUserId);
      await targetBatch.save();
    }

    const enrollmentDate = req.body.enrollmentDate
      ? new Date(req.body.enrollmentDate)
      : new Date();

    studentUser = await User.create({
      name: req.body.name || lead.name,
      email,
      password,
      role: 'student',
      phone: req.body.phone || lead.phone,
      status: 'active',
      mustChangePassword: true,
      passwordSetByAdmin: true,
      firstLoginCompleted: false
    });

    studentProfile = await Student.create({
      user: studentUser._id,
      counsellor: lead.assignedTo || null,
      teacher: selectedTeacherProfile?._id || null,
      course: selectedCourse._id,
      batch: targetBatch._id,
      enrollmentDate,
      fees_total: totalFees,
      fees_paid: paidFees,
      statusHistory: [{
        status: 'active',
        changedBy: req.user._id,
        reason: 'Enrolled via lead conversion'
      }]
    });

    const feeLedger = new Fee({
      student: studentProfile._id,
      course: selectedCourse._id,
      batch: targetBatch._id,
      totalAmount: totalFees,
      paidAmount: paidFees,
      courseDurationMonths: selectedCourse.durationMonths || 3,
      discountReason: paidFees < totalFees * 0.5
        ? 'Admin bypassed 50% down payment requirement'
        : '',
      payments: paidFees > 0 ? [{
        amount: paidFees,
        method: 'Cash',
        note: 'Admission down payment',
        receivedBy: req.user._id,
        paidAt: new Date()
      }] : []
    });

    const instName = req.body.instName || req.body['instName[]'];
    const instAmount = req.body.instAmount || req.body['instAmount[]'];
    const instDueDate = req.body.instDueDate || req.body['instDueDate[]'];

    if (instName && Array.isArray(instName) && instName.length > 0) {
      feeLedger.installments = instName
        .map((name, index) => ({
          name: String(name || '').trim(),
          amount: Number(instAmount[index]) || 0,
          dueDate: instDueDate[index] ? new Date(instDueDate[index]) : new Date(),
          paidAmount: 0
        }))
        .filter(installment => installment.name && installment.amount > 0);

      if (feeLedger.installments.length > 0) {
        feeLedger.dueDate = feeLedger.installments[feeLedger.installments.length - 1].dueDate;
      }
    }

    await feeLedger.save();

    lead.status = 'admission_completed';
    lead.convertedStudent = studentProfile._id;
    lead.convertedAt = new Date();

    lead.followUpHistory.push({
      note: `Converted to student successfully by admin. Student ID: ${studentProfile.rollNumber || studentProfile._id}`,
      status: 'admission_completed',
      channel: 'In-person',
      doneBy: req.user._id,
      doneAt: new Date()
    });

    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      type: 'converted',
      title: 'Admission Completed',
      note: `Converted into student profile ${studentProfile.rollNumber || studentProfile._id}.`,
      counsellor: lead.assignedTo || null,
      doneBy: req.user._id,
      newStatus: 'admission_completed'
    });

    logger.info('Lead converted successfully', {
      leadId: lead._id,
      studentId: studentProfile._id
    });

    res.redirect(`/admin/students?search=${encodeURIComponent(email)}&converted=1`);

  } catch (err) {
    logger.error('Convert Lead Error', {
      err: err.message,
      stack: err.stack
    });

    if (studentProfile) {
      await Student.findByIdAndDelete(studentProfile._id).catch(() => {});
    }

    if (studentUser) {
      await User.findByIdAndDelete(studentUser._id).catch(() => {});
    }

    if (lead) {
      return res.redirect(`/admin/leads/${lead._id}?error=${encodeURIComponent(err.message)}`);
    }

    res.redirect('/admin/leads?error=1');
  }
};

exports.postAddLeadComment = async (req, res) => {
  const { note, context } = req.body;

  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.redirect('/admin/leads');

    const cleanContext = String(context || '').trim();
    const cleanNote = cleanContext
      ? `${cleanContext}: ${note}`
      : note;

    lead.followUpHistory.push({
      note: cleanNote,
      status: lead.status,
      channel: 'note',
      doneBy: req.user._id,
      doneAt: new Date()
    });

    await lead.save();

    await LeadActivity.create({
      lead: lead._id,
      type: 'note',
      title: cleanContext ? 'Timeline Comment Added' : 'Admin Comment Added',
      note: cleanNote,
      counsellor: lead.assignedTo || null,
      doneBy: req.user._id
    });

    if (lead.assignedTo) {
      const counsellor = await Counsellor.findById(lead.assignedTo).populate('user', '_id status');
      if (counsellor?.user && counsellor.user.status === 'active') {
        await Message.create({
          sender: req.user._id,
          recipient: counsellor.user._id,
          content: `Admin added a comment to lead "${lead.name}": "${cleanNote.length > 80 ? cleanNote.slice(0, 77) + '...' : cleanNote}"\nOpen lead: /counsellor/leads/${lead._id}`
        });
      }
    }

    res.redirect(`/admin/leads/${req.params.id}?updated=1`);

  } catch (err) {
    logger.error('Admin Add Lead Comment Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect(`/admin/leads/${req.params.id}?error=1`);
  }
};
