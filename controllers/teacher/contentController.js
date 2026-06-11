const User = require('../../models/User');
const DailyUpdate = require('../../models/DailyUpdate');
const Curriculum = require('../../models/Curriculum');
const Schedule = require('../../models/Schedule');
const { todayIST } = require('../../utils/dateHelper');

// ─── DAILY UPDATES ────────────────────────────────────────────────────────────

/**
 * GET /teacher/updates
 * Lists this teacher's 30 most recent daily lesson updates, newest first.
 */
exports.getDailyUpdates = async (req, res) => {
  console.log('📰 Daily Updates list load:', { teacherId: req.user._id });
  try {
    const updates = await DailyUpdate.find({ teacher: req.user._id }).sort({ date: -1 }).limit(30);
    res.render('teacher/daily-updates', { title: 'Daily Updates', user: req.user, updates });
  } catch (err) {
    console.error('❌ Daily Updates List Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /teacher/updates/create
 * Shows the daily update creation form with available batches.
 * Admins see all batches; teachers see only batches from their schedule.
 */
exports.getCreateUpdate = async (req, res) => {
  console.log('📝 Create Update form load:', { teacherId: req.user._id });
  try {
    let batches;
    if (req.user.role === 'admin') {
      batches = await User.distinct('batch', { role: 'student', isActive: true });
    } else {
      batches = await Schedule.distinct('batch', { teacher: req.user._id });
    }
    res.render('teacher/update-form', { title: 'Post Update', user: req.user, batches });
  } catch (err) {
    console.error('❌ Create Update Form Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /teacher/updates/create
 * Creates a daily lesson update. Splits comma-separated topics into an array.
 * Validates that the teacher is authorised for the target batch via schedule records.
 */
exports.postCreateUpdate = async (req, res) => {
  console.log('📝 Post Lesson Update request:', {
    teacherId: req.user._id, subject: req.body.subject,
    batch: req.body.batch, date: req.body.date, hasFile: !!req.file,
  });
  try {
    if (req.user.role !== 'admin') {
      const validBatch = await Schedule.findOne({ teacher: req.user._id, batch: req.body.batch });
      if (!validBatch) {
        console.warn(`⚠️ Teacher unauthorized update attempt for batch ${req.body.batch}`);
        return res.status(403).render('403', { title: 'Access Denied', user: req.user });
      }
    }

    const data = { ...req.body, teacher: req.user._id };
    if (data.topics && typeof data.topics === 'string') {
      data.topics = data.topics.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (req.file) {
      data.fileUrl = `/uploads/${req.file.filename}`;
      data.fileName = req.file.originalname;
    }

    await DailyUpdate.create(data);
    res.redirect('/teacher/updates?posted=1');
  } catch (err) {
    console.error('❌ Post Lesson Update Error:', { teacherId: req.user._id, error: err.message });
    res.redirect('/teacher/updates?error=1');
  }
};

// ─── CURRICULUM ───────────────────────────────────────────────────────────────

/**
 * GET /teacher/curriculum
 * Lists all curriculum trackers this teacher has created.
 */
exports.getCurriculum = async (req, res) => {
  console.log('📚 Curriculum list load:', { teacherId: req.user._id });
  try {
    const [curricula, batches] = await Promise.all([
      Curriculum.find({ teacher: req.user._id }),
      User.distinct('batch', { role: 'student', isActive: true }),
    ]);
    res.render('teacher/curriculum', { title: 'Curriculum', user: req.user, curricula, batches });
  } catch (err) {
    console.error('❌ Curriculum List Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /teacher/curriculum
 * Creates a new curriculum tracker for a subject + batch combination.
 * Prevents duplicates — same subject+batch redirects with ?exists=1.
 */
exports.postCreateCurriculum = async (req, res) => {
  const { subject, batch, description } = req.body;
  console.log('📚 Create Curriculum request:', { teacherId: req.user._id, subject, batch });
  try {
    const exists = await Curriculum.findOne({ subject, batch });
    if (exists) return res.redirect('/teacher/curriculum?exists=1');
    await Curriculum.create({ subject, batch, description, teacher: req.user._id, topics: [] });
    res.redirect('/teacher/curriculum?created=1');
  } catch (err) {
    console.error('❌ Create Curriculum Error:', { teacherId: req.user._id, error: err.message });
    res.redirect('/teacher/curriculum?error=1');
  }
};

/**
 * GET /teacher/curriculum/:id
 * Shows the detail page for a single curriculum tracker including its topic list.
 * Only accessible to the teacher who owns it.
 */
exports.getCurriculumDetail = async (req, res) => {
  console.log('📄 Curriculum Detail load:', { teacherId: req.user._id, curriculumId: req.params.id });
  try {
    const curriculum = await Curriculum.findOne({ _id: req.params.id, teacher: req.user._id });
    if (!curriculum) return res.redirect('/teacher/curriculum');
    res.render('teacher/curriculum-detail', { title: curriculum.subject, user: req.user, curriculum });
  } catch (err) {
    console.error('❌ Curriculum Detail Load Error:', { curriculumId: req.params.id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /teacher/curriculum/:id/topics
 * Appends a new topic to a curriculum tracker using $push.
 */
exports.postAddTopic = async (req, res) => {
  const { name, description, order } = req.body;
  console.log('➕ Add Topic request:', { curriculumId: req.params.id, topicName: name });
  try {
    await Curriculum.findByIdAndUpdate(req.params.id, {
      $push: { topics: { name, description, order: Number(order) || 0 } },
    });
    res.redirect(`/teacher/curriculum/${req.params.id}?added=1`);
  } catch (err) {
    console.error('❌ Add Topic Error:', { curriculumId: req.params.id, error: err.message });
    res.redirect(`/teacher/curriculum/${req.params.id}?error=1`);
  }
};

/**
 * POST /teacher/curriculum/:id/topics/:topicId/toggle
 * Toggles a topic's completed state and records completedDate when marking done.
 */
exports.postToggleTopic = async (req, res) => {
  console.log('🔄 Toggle Topic request:', { curriculumId: req.params.id, topicId: req.params.topicId });
  try {
    const curr = await Curriculum.findById(req.params.id);
    if (!curr) return res.redirect('/teacher/curriculum');

    const topic = curr.topics.id(req.params.topicId);
    if (!topic) return res.redirect(`/teacher/curriculum/${req.params.id}?error=1`);

    topic.completed = !topic.completed;
    topic.completedDate = topic.completed ? todayIST() : null;
    await curr.save();

    res.redirect(`/teacher/curriculum/${req.params.id}`);
  } catch (err) {
    console.error('❌ Toggle Topic Error:', { curriculumId: req.params.id, error: err.message });
    res.redirect(`/teacher/curriculum/${req.params.id}?error=1`);
  }
};