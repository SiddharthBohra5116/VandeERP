const User = require('../../models/User');
const Student = require('../../models/Student');
const Course = require('../../models/Course');
const Batch = require('../../models/Batch');
const Lead = require('../../models/Lead');
const LeadActivity = require('../../models/LeadActivity');
const Fee = require('../../models/Fee');
const Message = require('../../models/Message');
const Counsellor = require('../../models/Counsellor');

const { escapeRegex } = require('../../utils/sanitize');
const { computeSourceStats } = require('../../utils/leadAnalytics');
const logger = require('../../utils/logger');

async function resolveCourse(courseValue, fallbackCourseId = null) {
  if (courseValue && courseValue.match && courseValue.match(/^[0-9a-fA-F]{24}$/)) {
    return await Course.findById(courseValue);
  }

  if (courseValue) {
    const course = await Course.findOne({
      $or: [
        { name: courseValue },
        { code: String(courseValue).toUpperCase() }
      ]
    });

    if (course) return course;
  }

  if (fallbackCourseId) {
    return await Course.findById(fallbackCourseId);
  }

  return null;
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

    const [leads, totalLeads] = await Promise.all([
      Lead.find(filter)
        .populate({ path: 'assignedTo', populate: { path: 'user', select: 'name email phone' } })
        .populate('interestedCourse', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(filter)
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

    res.render('admin/lead-detail', {
      title: lead.name,
      user: req.user,
      lead,
      leadActivities,
      counsellors,
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
