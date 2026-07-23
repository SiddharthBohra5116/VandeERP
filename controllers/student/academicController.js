const DailyUpdate = require('../../models/DailyUpdate');
const Progress = require('../../models/Progress');
const Curriculum = require('../../models/Curriculum');
const Fee = require('../../models/Fee');
const Student = require('../../models/Student');
const Announcement = require('../../models/Announcement');

exports.getAnnouncements = async (req, res) => {
  try {
    const studentProfile = await Student.findOne({ user: req.user._id }).populate('counsellor', 'user');
    const counsellorUserId = studentProfile?.counsellor?.user || null;
    const announcements = await Announcement.find({
      isActive: true,
      $or: [
        { audienceType: 'all' },
        { audienceType: 'role', role: 'student' },
        { audienceType: 'course', course: studentProfile.course },
        { audienceType: 'batch', batch: studentProfile.batch },
        ...(counsellorUserId ? [{ audienceType: 'counsellor', counsellor: counsellorUserId }] : [])
      ]
    }).populate('createdBy', 'name role').sort({ createdAt: -1 });

    res.render('student/announcements', {
      title: 'Announcements & Materials',
      user: req.user,
      announcements
    });
  } catch (err) {
    console.error('Student announcements fetch error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

// ─── DAILY UPDATES ────────────────────────────────────────────────────────────

/**
 * GET /student/updates
 * Fetches the 50 most recent daily class updates for the student's batch,
 * optionally filtered by subject or date.
 */
exports.getDailyUpdates = async (req, res) => {
  try {
    const studentProfile = await Student.findOne({ user: req.user._id });
    if (!studentProfile) {
      return res.redirect('/student/dashboard?error=Student+profile+not+found');
    }

    if (!req.user.batch) {
      return res.render('student/updates', { title: 'Class Updates', user: req.user, updates: [], filter: req.query });
    }

    const { subject, date } = req.query;
    const filter = { batch: req.user.batch };
    if (subject) {
      const Course = require('../../models/Course');
      const courses = await Course.find({ name: { $regex: subject, $options: 'i' } });
      filter.course = { $in: courses.map(c => c._id) };
    }
    if (date) filter.date = date;

    const updates = await DailyUpdate.find(filter)
      .populate('course', 'name')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
      .sort({ date: -1 })
      .limit(50);

    res.render('student/updates', { title: 'Class Updates', user: req.user, updates, filter: req.query });
  } catch (err) {
    console.error('❌ Student Daily Updates Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

// ─── PROGRESS ─────────────────────────────────────────────────────────────────

/**
 * GET /student/progress
 * Fetches all progress records for the student across all subjects,
 * including test results and teacher remarks.
 */
exports.getProgress = async (req, res) => {
  res.redirect('/student/analytics');
};

// ─── CURRICULUM ───────────────────────────────────────────────────────────────

/**
 * GET /student/curriculum
 * Fetches all curriculum trackers for the student's batch, showing topic
 * completion status as marked by their teacher.
 */
exports.getCurriculum = async (req, res) => {
  try {
    const studentProfile = await Student.findOne({ user: req.user._id });
    if (!studentProfile) {
      return res.redirect('/student/dashboard?error=Student+profile+not+found');
    }

    const isKycIncomplete = !studentProfile.family?.father?.name || !studentProfile.family?.guardian?.phone || !studentProfile.documents?.idProof;
    if (isKycIncomplete) {
      return res.status(403).render('403', {
        title: 'Access Restricted',
        user: req.user,
        error: 'Complete your profile KYC (Identity proof, Father\'s Name, Guardian Phone) on the dashboard to access curriculum.'
      });
    }

    if (!req.user.batch) {
      return res.render('student/curriculum', { title: 'Curriculum', user: req.user, curricula: [] });
    }

    const curricula = await Curriculum.find({ batch: req.user.batch })
      .populate('course')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } });
    res.render('student/curriculum', { title: 'Curriculum', user: req.user, curricula });
  } catch (err) {
    console.error('❌ Student Curriculum Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

// ─── FEES ─────────────────────────────────────────────────────────────────────

/**
 * GET /student/fees
 * Fetches the student's fee ledger including all installments, payments,
 * and outstanding balance.
 */
exports.getFees = async (req, res) => {
  try {
    const studentProfile = await Student.findOne({ user: req.user._id });
    if (!studentProfile) {
      return res.redirect('/student/dashboard?error=Student+profile+not+found');
    }

    const fee = await Fee.findOne({ student: studentProfile._id }).populate({
      path: 'payments.receivedBy',
      select: 'name'
    });
    res.render('student/fees', { title: 'My Fees', user: req.user, fee });
  } catch (err) {
    console.error('❌ Student Fees Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};
