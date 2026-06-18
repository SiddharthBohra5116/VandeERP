const Announcement = require('../../models/Announcement');
const Batch = require('../../models/Batch');
const Schedule = require('../../models/Schedule');
const asyncHandler = require('../../middleware/asyncHandler');
const logger = require('../../utils/logger');

// GET /teacher/announcements
exports.getTeacherAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find({ createdBy: req.user._id })
    .populate('batch', 'name')
    .sort({ createdAt: -1 });

  res.render('teacher/announcements', {
    title: 'My Announcements',
    announcements,
    user: req.user
  });
});

// GET /teacher/announcements/create
exports.getTeacherCreateAnnouncement = asyncHandler(async (req, res) => {
  const scheduledBatchIds = req.user.teacherProfileId
    ? await Schedule.distinct('batch', { teacher: req.user.teacherProfileId })
    : [];

  const batchIds = Array.from(new Set(scheduledBatchIds.map(id => id.toString())));
  const teacherIds = [req.user._id, req.user.teacherProfileId].filter(Boolean);
  const batches = await Batch.find({
    isActive: true,
    $or: [
      { teachers: { $in: teacherIds } },
      { _id: { $in: batchIds } }
    ]
  }).sort({ name: 1 });

  res.render('teacher/announcement-form', {
    title: 'Post Announcement to Batch',
    batches,
    user: req.user
  });
});

// POST /teacher/announcements/create
exports.postTeacherCreateAnnouncement = asyncHandler(async (req, res) => {
  const { title, content, batch } = req.body;

  const newAnnouncement = new Announcement({
    title,
    content,
    audienceType: 'batch',
    createdBy: req.user._id,
    batch
  });

  await newAnnouncement.save();
  logger.info(`Teacher ${req.user.name} posted announcement to batch ${batch}: ${title}`);

  res.redirect('/teacher/announcements?created=true');
});

// POST /teacher/announcements/:id/toggle
exports.postTeacherToggleAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!announcement) {
    return res.status(404).render('404', { title: 'Announcement Not Found', layout: 'main' });
  }

  announcement.isActive = !announcement.isActive;
  await announcement.save();

  res.redirect('/teacher/announcements?updated=true');
});
