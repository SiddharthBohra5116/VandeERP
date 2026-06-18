const Announcement = require('../../models/Announcement');
const asyncHandler = require('../../middleware/asyncHandler');
const logger = require('../../utils/logger');

// GET /counsellor/announcements
exports.getCounsellorAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find({ createdBy: req.user._id })
    .sort({ createdAt: -1 });

  res.render('counsellor/announcements', {
    title: 'My Announcements',
    announcements,
    user: req.user
  });
});

// GET /counsellor/announcements/create
exports.getCounsellorCreateAnnouncement = asyncHandler(async (req, res) => {
  res.render('counsellor/announcement-form', {
    title: 'Post Announcement to Assigned Students',
    user: req.user
  });
});

// POST /counsellor/announcements/create
exports.postCounsellorCreateAnnouncement = asyncHandler(async (req, res) => {
  const { title, content } = req.body;

  const newAnnouncement = new Announcement({
    title,
    content,
    audienceType: 'counsellor',
    createdBy: req.user._id,
    counsellor: req.user._id // Stores counsellor's User ID to target their assigned students
  });

  await newAnnouncement.save();
  logger.info(`Counsellor ${req.user.name} posted announcement to assigned students: ${title}`);

  res.redirect('/counsellor/announcements?created=true');
});

// POST /counsellor/announcements/:id/toggle
exports.postCounsellorToggleAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!announcement) {
    return res.status(404).render('404', { title: 'Announcement Not Found', layout: 'main' });
  }

  announcement.isActive = !announcement.isActive;
  await announcement.save();

  res.redirect('/counsellor/announcements?updated=true');
});
