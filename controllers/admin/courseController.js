const Course = require('../../models/Course');
const Lead = require('../../models/Lead');
const { importedCourseCode } = require('../../utils/csvParser');
const logger = require('../../utils/logger');

exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find().sort({ isActive: -1, name: 1 }).lean();
    const leadCounts = await Lead.aggregate([
      { $match: { interestedCourse: { $ne: null } } },
      { $group: { _id: '$interestedCourse', count: { $sum: 1 } } }
    ]);
    const counts = new Map(leadCounts.map(item => [String(item._id), item.count]));
    courses.forEach(course => { course.leadCount = counts.get(String(course._id)) || 0; });

    res.render('admin/courses', { title: 'Course Management', user: req.user, courses, filter: req.query });
  } catch (err) {
    logger.error('getCourses Error', { err: err.message, stack: err.stack });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

exports.postCreateCourse = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.redirect('/admin/courses?error=Course+name+is+required');
    const code = String(req.body.code || importedCourseCode(name)).trim().toUpperCase();
    const requiredClasses = Math.max(0, parseInt(req.body.requiredClasses, 10) || 0);
    await Course.create({ name, code, requiredClasses });
    res.redirect('/admin/courses?created=1');
  } catch (err) {
    logger.error('postCreateCourse Error', { err: err.message });
    res.redirect(`/admin/courses?error=${encodeURIComponent(err.code === 11000 ? 'Course name or code already exists.' : err.message)}`);
  }
};

exports.postUpdateCourse = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!name || !code) return res.redirect('/admin/courses?error=Course+name+and+code+are+required');
    const requiredClasses = Math.max(0, parseInt(req.body.requiredClasses, 10) || 0);
    await Course.findByIdAndUpdate(req.params.id, { name, code, requiredClasses }, { runValidators: true });
    res.redirect('/admin/courses?updated=1');
  } catch (err) {
    logger.error('postUpdateCourse Error', { err: err.message });
    res.redirect(`/admin/courses?error=${encodeURIComponent(err.code === 11000 ? 'Course name or code already exists.' : err.message)}`);
  }
};

exports.postToggleCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (course) {
      course.isActive = !course.isActive;
      await course.save();
    }
    res.redirect('/admin/courses');
  } catch (err) {
    logger.error('postToggleCourse Error', { err: err.message });
    res.redirect('/admin/courses?error=Unable+to+update+course');
  }
};
