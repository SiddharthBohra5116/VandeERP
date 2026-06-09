const DailyUpdate = require('../../models/DailyUpdate');
const Progress = require('../../models/Progress');
const Curriculum = require('../../models/Curriculum');
const Fee = require('../../models/Fee');

// ─── DAILY UPDATES ────────────────────────────────────────────────────────────

/**
 * GET /student/updates
 * Fetches the 50 most recent daily class updates for the student's batch,
 * optionally filtered by subject or date.
 */
exports.getDailyUpdates = async (req, res) => {
  try {
    if (!req.user.batch) {
      return res.render('student/updates', { title: 'Class Updates', user: req.user, updates: [], filter: req.query });
    }

    const { subject, date } = req.query;
    const filter = { batch: req.user.batch };
    if (subject) filter.subject = subject;
    if (date) filter.date = date;

    const updates = await DailyUpdate.find(filter)
      .populate('teacher', 'name')
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
  try {
    const progressRecords = await Progress.find({ student: req.user._id }).populate('teacher', 'name');
    res.render('student/progress', { title: 'My Progress', user: req.user, progressRecords });
  } catch (err) {
    console.error('❌ Student Progress Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

// ─── CURRICULUM ───────────────────────────────────────────────────────────────

/**
 * GET /student/curriculum
 * Fetches all curriculum trackers for the student's batch, showing topic
 * completion status as marked by their teacher.
 */
exports.getCurriculum = async (req, res) => {
  try {
    const isKycIncomplete = !req.user.idProof || !req.user.fatherName || !req.user.guardianPhone;
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

    const curricula = await Curriculum.find({ batch: req.user.batch }).populate('teacher', 'name');
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
    const fee = await Fee.findOne({ student: req.user._id })
      .populate('student', 'name course batch phone email')
      .populate('payments.receivedBy', 'name');
    res.render('student/fees', { title: 'My Fees', user: req.user, fee });
  } catch (err) {
    console.error('❌ Student Fees Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};