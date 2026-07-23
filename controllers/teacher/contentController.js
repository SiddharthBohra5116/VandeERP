const User = require('../../models/User');
const DailyUpdate = require('../../models/DailyUpdate');
const Curriculum = require('../../models/Curriculum');
const Schedule = require('../../models/Schedule');
const Student = require('../../models/Student');
const Batch = require('../../models/Batch');
const Course = require('../../models/Course');
const { todayIST } = require('../../utils/dateHelper');
const { storeUploadedFiles, discardStoredFiles } = require('../../utils/announcementStorage');

// ─── DAILY UPDATES ────────────────────────────────────────────────────────────

/**
 * Lists this teacher's 30 most recent daily lesson updates, newest first.
 */
exports.getDailyUpdates = async (req, res) => {
  console.log('📰 Daily Updates list load:', { teacherId: req.user._id });
  try {
    const { batch = 'all', date = '', q = '' } = req.query;
    const updateFilter = { teacher: req.user.teacherProfileId };
    if (batch !== 'all') updateFilter.batch = batch;
    if (date) updateFilter.date = date;

    const [updates, batchIds] = await Promise.all([
      DailyUpdate.find(updateFilter)
        .populate('batch')
        .populate('course')
        .sort({ date: -1 })
        .limit(60),
      Schedule.distinct('batch', { teacher: req.user.teacherProfileId })
    ]);
    const batches = await Batch.find({ _id: { $in: batchIds }, isActive: true }).select('name');
    const search = String(q || '').trim().toLowerCase();
    const visibleUpdates = search
      ? updates.filter(up => [up.content, up.homework, up.batch?.name, up.course?.name]
        .some(value => String(value || '').toLowerCase().includes(search)))
      : updates;

    res.render('teacher/daily-updates', {
      title: 'Daily Updates',
      user: req.user,
      updates: visibleUpdates,
      batches,
      filter: { batch, date, q }
    });
  } catch (err) {
    console.error('❌ Daily Updates List Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

exports.getCreateUpdate = async (req, res) => {
  console.log('📝 Create Update form load:', { teacherId: req.user._id });
  try {
    let batchIds;
    if (req.user.role === 'admin') {
      batchIds = await Student.distinct('batch');
    } else {
      batchIds = await Schedule.distinct('batch', { teacher: req.user.teacherProfileId });
    }
    const batches = await Batch.find({ _id: { $in: batchIds }, isActive: true }).select('name');
    const schedule = req.query.schedule
      ? await Schedule.findOne({ _id: req.query.schedule, teacher: req.user.teacherProfileId })
        .populate('batch', 'name')
        .populate('course', 'name')
      : null;

    res.render('teacher/update-form', {
      title: 'Post Update',
      user: req.user,
      batches,
      prefill: {
        scheduleId: schedule?._id || '',
        batch: schedule?.batch?._id || '',
        date: schedule?.date || todayIST(),
        courseName: schedule?.course?.name || '',
        completed: req.query.completed === '1'
      }
    });
  } catch (err) {
    console.error('❌ Create Update Form Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * Creates a daily lesson update. Splits comma-separated topics into an array.
 * Validates that the teacher is authorised for the target batch via schedule records.
 */
exports.postCreateUpdate = async (req, res) => {
  console.log('📝 Post Lesson Update request:', {
    teacherId: req.user._id, subject: req.body.subject,
    batch: req.body.batch, date: req.body.date, hasFile: !!req.file,
  });
  try {
    const today = todayIST();
    if (req.body.date > today) {
      console.warn(`⚠️ Attempted daily update for a future date: ${req.body.date}`);
      return res.redirect('/teacher/updates?error=Cannot post updates for future dates');
    }

    if (req.user.role !== 'admin') {
      const validBatch = await Schedule.findOne({ teacher: req.user.teacherProfileId, batch: req.body.batch });
      if (!validBatch) {
        console.warn(`⚠️ Teacher unauthorized update attempt for batch ${req.body.batch}`);
        return res.status(403).render('403', { title: 'Access Denied', user: req.user });
      }
    }

    const batchDoc = await Batch.findById(req.body.batch);
    if (!batchDoc) {
      console.warn(`⚠️ Batch not found for daily update: ${req.body.batch}`);
      return res.redirect('/teacher/updates?error=batch_not_found');
    }

    const topicsText = String(req.body.topics || '').trim();
    const topicList = topicsText.split(',').map(t => t.trim()).filter(Boolean);
    const data = { 
      ...req.body, 
      content: topicsText,
      topics: topicList,
      title: topicsText ? topicsText.split(',')[0].trim() : 'Class update',
      teacher: req.user.teacherProfileId,
      course: batchDoc.course, // Set the required course ref from the batch
    };
    const [uploadedFile] = await storeUploadedFiles(req.file ? [req.file] : [], 'daily-updates');
    if (uploadedFile) {
      data.fileUrl = uploadedFile.url;
      data.fileName = uploadedFile.fileName;
      data.filePublicId = uploadedFile.publicId;
      data.fileResourceType = uploadedFile.resourceType;
      data.fileDeliveryType = uploadedFile.deliveryType;
    }

    try {
      await DailyUpdate.create(data);
    } catch (error) {
      await discardStoredFiles(uploadedFile ? [uploadedFile] : []);
      throw error;
    }
    res.redirect('/teacher/updates?posted=1');
  } catch (err) {
    console.error('❌ Post Lesson Update Error:', { teacherId: req.user._id, error: err.message });
    res.redirect('/teacher/updates?error=1');
  }
};

// ─── CURRICULUM ───────────────────────────────────────────────────────────────

/**
 * Lists all curriculum trackers this teacher has created.
 */
exports.getCurriculum = async (req, res) => {
  console.log('📚 Curriculum list load:', { teacherId: req.user._id });
  try {
    const assignedBatches = await Schedule.distinct('batch', { teacher: req.user.teacherProfileId });
    const [curricula, batches] = await Promise.all([
      Curriculum.find({ teacher: req.user.teacherProfileId }).populate('course').populate('batch'),
      Batch.find({ _id: { $in: assignedBatches }, isActive: true }),
    ]);
    res.render('teacher/curriculum', { title: 'Curriculum', user: req.user, curricula, batches });
  } catch (err) {
    console.error('❌ Curriculum List Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * Creates a new curriculum tracker for a subject + batch combination.
 * Prevents duplicates — same subject+batch redirects with ?exists=1.
 */
exports.postCreateCurriculum = async (req, res) => {
  const { batch, description } = req.body;
  console.log('📚 Create Curriculum request:', { teacherId: req.user._id, batch });
  try {
    const batchDoc = await Batch.findById(batch);
    if (!batchDoc) {
      return res.redirect('/teacher/curriculum?error=batch_not_found');
    }
    const courseId = batchDoc.course;
    const exists = await Curriculum.findOne({ course: courseId, batch });
    if (exists) return res.redirect('/teacher/curriculum?exists=1');

    await Curriculum.create({
      course: courseId,
      batch,
      description,
      teacher: req.user.teacherProfileId,
      completedTopics: []
    });
    res.redirect('/teacher/curriculum?created=1');
  } catch (err) {
    console.error('❌ Create Curriculum Error:', { teacherId: req.user._id, error: err.message });
    res.redirect('/teacher/curriculum?error=1');
  }
};

/**
 * Shows the detail page for a single curriculum tracker including its topic list.
 * Only accessible to the teacher who owns it.
 */
exports.getCurriculumDetail = async (req, res) => {
  console.log('📄 Curriculum Detail load:', { teacherId: req.user._id, curriculumId: req.params.id });
  try {
    const curriculum = await Curriculum.findOne({ _id: req.params.id, teacher: req.user.teacherProfileId })
      .populate('course')
      .populate('batch');
    if (!curriculum) return res.redirect('/teacher/curriculum');
    res.render('teacher/curriculum-detail', { title: curriculum.subject, user: req.user, curriculum });
  } catch (err) {
    console.error('❌ Curriculum Detail Load Error:', { curriculumId: req.params.id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * Appends a new topic to a curriculum tracker.
 */
exports.postAddTopic = async (req, res) => {
  const { name, description, order } = req.body;
  console.log('➕ Add Topic request:', { curriculumId: req.params.id, topicName: name });
  try {
    const curriculum = await Curriculum.findById(req.params.id).populate('course');
    if (!curriculum) return res.redirect('/teacher/curriculum');

    const courseDoc = curriculum.course;
    if (!courseDoc) {
      return res.redirect(`/teacher/curriculum/${req.params.id}?error=course_not_found`);
    }

    if (!courseDoc.modules || courseDoc.modules.length === 0) {
      courseDoc.modules = [{
        title: 'Module 1: General',
        order: 1,
        topics: []
      }];
    }

    const targetModule = courseDoc.modules[courseDoc.modules.length - 1];
    targetModule.topics.push({
      title: name,
      description: description || '',
      order: Number(order) || 0
    });

    await courseDoc.save();
    res.redirect(`/teacher/curriculum/${req.params.id}?added=1`);
  } catch (err) {
    console.error('❌ Add Topic Error:', { curriculumId: req.params.id, error: err.message });
    res.redirect(`/teacher/curriculum/${req.params.id}?error=1`);
  }
};

/**
 * Toggles a topic's completed state and records completedDate when marking done.
 */
exports.postToggleTopic = async (req, res) => {
  console.log('🔄 Toggle Topic request:', { curriculumId: req.params.id, topicId: req.params.topicId });
  try {
    const curr = await Curriculum.findById(req.params.id).populate('course');
    if (!curr) return res.redirect('/teacher/curriculum');

    let targetModuleId = null;
    for (const module of curr.course.modules) {
      const hasTopic = module.topics.some(t => t._id.toString() === req.params.topicId);
      if (hasTopic) {
        targetModuleId = module._id;
        break;
      }
    }

    if (!targetModuleId) {
      console.error('❌ Topic not found in course modules:', req.params.topicId);
      return res.redirect(`/teacher/curriculum/${req.params.id}?error=topic_not_found`);
    }

    const existingIndex = curr.completedTopics.findIndex(ct =>
      ct.topicId.toString() === req.params.topicId
    );

    if (existingIndex > -1) {
      curr.completedTopics.splice(existingIndex, 1);
    } else {
      curr.completedTopics.push({
        moduleId: targetModuleId,
        topicId: req.params.topicId,
        completedBy: req.user._id,
        completedDate: todayIST(),
        note: 'Marked completed by teacher'
      });
    }

    await curr.save();
    res.redirect(`/teacher/curriculum/${req.params.id}`);
  } catch (err) {
    console.error('❌ Toggle Topic Error:', { curriculumId: req.params.id, error: err.message });
    res.redirect(`/teacher/curriculum/${req.params.id}?error=1`);
  }
};
