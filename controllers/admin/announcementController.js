const Announcement = require('../../models/Announcement');
const Course = require('../../models/Course');
const Batch = require('../../models/Batch');
const User = require('../../models/User');
const asyncHandler = require('../../middleware/asyncHandler');
const logger = require('../../utils/logger');

// GET /admin/announcements
exports.getAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find()
    .populate('createdBy', 'name role')
    .populate('course', 'name')
    .populate('batch', 'name')
    .populate('counsellor', 'name')
    .sort({ createdAt: -1 });

  res.render('admin/announcements', {
    title: 'Manage Announcements',
    announcements,
    user: req.user
  });
});

// GET /admin/announcements/create
exports.getCreateAnnouncement = asyncHandler(async (req, res) => {
  const [courses, batches, counsellors] = await Promise.all([
    Course.find({ isActive: true }).sort({ name: 1 }),
    Batch.find({ isActive: true }).sort({ name: 1 }),
    User.find({ role: 'counsellor' }).sort({ name: 1 })
  ]);

  res.render('admin/announcement-form', {
    title: 'Create Announcement',
    courses,
    batches,
    counsellors,
    user: req.user
  });
});

// POST /admin/announcements/create
exports.postCreateAnnouncement = asyncHandler(async (req, res) => {
  const { title, content, audienceType, course, batch, role, counsellor } = req.body;

  const newAnnouncement = new Announcement({
    title,
    content,
    audienceType,
    createdBy: req.user._id,
    course: audienceType === 'course' ? course : null,
    batch: audienceType === 'batch' ? batch : null,
    role: audienceType === 'role' ? role : '',
    counsellor: audienceType === 'counsellor' ? counsellor : null
  });

  await newAnnouncement.save();
  logger.info(`Announcement created by Admin ${req.user.name}: ${title}`);

  res.redirect('/admin/announcements?created=true');
});

// POST /admin/announcements/:id/toggle
exports.postToggleAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) {
    return res.status(404).render('404', { title: 'Announcement Not Found', layout: 'main' });
  }

  announcement.isActive = !announcement.isActive;
  await announcement.save();

  logger.info(`Announcement status toggled: ${announcement.title} is now ${announcement.isActive ? 'Active' : 'Inactive'}`);
  res.redirect('/admin/announcements?updated=true');
});
