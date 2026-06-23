const User = require('../../models/User');
const Student = require('../../models/Student');
const Batch = require('../../models/Batch');
const Course = require('../../models/Course');
const Teacher = require('../../models/Teacher');
const Message = require('../../models/Message');

const logger = require('../../utils/logger');


// GET /admin/batches
exports.getBatches = async (req, res) => {
  try {
    const { search } = req.query;

    const filter = {};

    if (search) {
      const escaped = search.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

      filter.name = {
        $regex: new RegExp(escaped, 'i')
      };
    }

    const batches = await Batch.find(filter)
      .populate('course', 'name code')
      .populate('teachers', 'name email phone')
      .sort({ createdAt: -1 });

    res.render('admin/batches', {
      title: 'Batch Management',
      user: req.user,
      batches,
      filter: req.query
    });

  } catch (err) {
    logger.error('getBatches Error', {
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

// GET /admin/batches/:id/students
exports.getBatchStudents = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate('course', 'name code')
      .populate('teachers', 'name email phone');

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const students = await Student.find({ batch: batch._id })
      .populate('user', 'name email phone status profilePic')
      .populate('course', 'name code')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name email phone' } })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      batch,
      students
    });

  } catch (err) {
    logger.error('getBatchStudents Error', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).json({
      success: false,
      message: 'Unable to load batch students'
    });
  }
};


// GET /admin/batches/create
exports.getCreateBatch = async (req, res) => {
  try {
    const [teachers, courses] = await Promise.all([
      User.find({
        role: 'teacher',
        status: 'active'
      }).select('name email'),

      Course.find({
        isActive: true
      }).sort({ name: 1 })
    ]);

    res.render('admin/batch-form', {
      title: 'Create Batch',
      user: req.user,
      target: null,
      teachers,
      courses
    });

  } catch (err) {
    logger.error('getCreateBatch Error', {
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


// POST /admin/batches/create
exports.postCreateBatch = async (req, res) => {
  const {
    name,
    course,
    capacity,
    teachers,
    startDate,
    endDate,
    isActive
  } = req.body;

  try {
    const exists = await Batch.findOne({
      name: name.trim()
    });

    if (exists) {
      const [allTeachers, courses] = await Promise.all([
        User.find({
          role: 'teacher',
          status: 'active'
        }).select('name email'),

        Course.find({
          isActive: true
        }).sort({ name: 1 })
      ]);

      return res.render('admin/batch-form', {
        title: 'Create Batch',
        user: req.user,
        target: null,
        teachers: allTeachers,
        courses,
        error: 'A batch with this name already exists.'
      });
    }

    let teachersArray = [];

    if (teachers) {
      teachersArray = Array.isArray(teachers)
        ? teachers
        : [teachers];
    }

    const createdBatch = await Batch.create({
      name: name.trim(),
      course,
      capacity: Number(capacity) || 20,
      teachers: teachersArray,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isActive: isActive === 'true' || isActive === 'on'
    });

    if (teachersArray.length > 0) {
      const courseDoc = await Course.findById(course);
      const courseName = courseDoc ? courseDoc.name : 'Assigned Course';

      // Update Teacher Profiles to include this course
      await Teacher.updateMany(
        { user: { $in: teachersArray } },
        { $addToSet: { courses: course } }
      );

      // Generate Inbox Messages (Notifications) for each teacher from the admin
      const notifications = teachersArray.map(teacherUserId => {
        return Message.create({
          sender: req.user._id,
          recipient: teacherUserId,
          content: `You have been assigned to batch "${name.trim()}" for course "${courseName}".`
        });
      });
      await Promise.all(notifications);
    }

    logger.info('Batch created successfully', {
      name,
      course
    });

    res.redirect('/admin/batches?created=1');

  } catch (err) {
    logger.error('postCreateBatch Error', {
      err: err.message,
      stack: err.stack
    });

    const [allTeachers, courses] = await Promise.all([
      User.find({
        role: 'teacher',
        status: 'active'
      }).select('name email'),

      Course.find({
        isActive: true
      }).sort({ name: 1 })
    ]);

    res.render('admin/batch-form', {
      title: 'Create Batch',
      user: req.user,
      target: null,
      teachers: allTeachers,
      courses,
      error: err.message
    });
  }
};


// GET /admin/batches/:id/edit
exports.getEditBatch = async (req, res) => {
  try {
    const target = await Batch.findById(req.params.id)
      .populate('course', 'name code');

    if (!target) {
      return res.redirect('/admin/batches');
    }

    const [teachers, courses] = await Promise.all([
      User.find({
        role: 'teacher',
        status: 'active'
      }).select('name email'),

      Course.find({
        isActive: true
      }).sort({ name: 1 })
    ]);

    res.render('admin/batch-form', {
      title: 'Edit Batch',
      user: req.user,
      target,
      teachers,
      courses
    });

  } catch (err) {
    logger.error('getEditBatch Error', {
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


// POST /admin/batches/:id/edit
exports.postEditBatch = async (req, res) => {
  const {
    name,
    course,
    capacity,
    teachers,
    startDate,
    endDate,
    isActive
  } = req.body;

  try {
    const exists = await Batch.findOne({
      name: name.trim(),
      _id: { $ne: req.params.id }
    });

    if (exists) {
      const [target, allTeachers, courses] = await Promise.all([
        Batch.findById(req.params.id),
        User.find({
          role: 'teacher',
          status: 'active'
        }).select('name email'),
        Course.find({
          isActive: true
        }).sort({ name: 1 })
      ]);

      return res.render('admin/batch-form', {
        title: 'Edit Batch',
        user: req.user,
        target,
        teachers: allTeachers,
        courses,
        error: 'A batch with this name already exists.'
      });
    }

    let teachersArray = [];

    if (teachers) {
      teachersArray = Array.isArray(teachers)
        ? teachers
        : [teachers];
    }

    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.redirect('/admin/batches');
    }

    const oldTeacherIds = (batch.teachers || []).map(id => id.toString()).sort();
    const oldCourseId = batch.course ? batch.course.toString() : '';

    batch.name = name.trim();
    batch.course = course;
    batch.capacity = Number(capacity) || 20;
    batch.teachers = teachersArray;
    batch.startDate = startDate ? new Date(startDate) : null;
    batch.endDate = endDate ? new Date(endDate) : null;
    batch.isActive = isActive === 'true' || isActive === 'on';

    await batch.save();

    // Sync teacher courses & send notifications to teachers
    if (teachersArray.length > 0) {
      const courseDoc = await Course.findById(batch.course);
      const courseName = courseDoc ? courseDoc.name : 'Assigned Course';

      // Update Teacher Profiles to include this course
      await Teacher.updateMany(
        { user: { $in: teachersArray } },
        { $addToSet: { courses: batch.course } }
      );

      const newlyAssignedTeachers = teachersArray.filter(id => !oldTeacherIds.includes(id.toString()));
      const teacherNotifications = [];

      newlyAssignedTeachers.forEach(teacherUserId => {
        teacherNotifications.push(Message.create({
          sender: req.user._id,
          recipient: teacherUserId,
          content: `You have been assigned to batch "${batch.name}" for course "${courseName}".`
        }));
      });

      const courseChanged = oldCourseId !== String(batch.course || '');
      if (courseChanged) {
        const teachersToNotify = teachersArray.filter(id => !newlyAssignedTeachers.includes(id.toString()));
        teachersToNotify.forEach(teacherUserId => {
          teacherNotifications.push(Message.create({
            sender: req.user._id,
            recipient: teacherUserId,
            content: `The course for batch "${batch.name}" has been updated to "${courseName}".`
          }));
        });
      }

      if (teacherNotifications.length > 0) {
        await Promise.all(teacherNotifications);
      }
    }

    const newTeacherIds = teachersArray.map(id => id.toString()).sort();
    const teachersChanged = oldTeacherIds.join(',') !== newTeacherIds.join(',');
    const courseChanged = oldCourseId !== String(batch.course || '');

    if (teachersChanged || courseChanged) {
      const newPrimaryTeacher = teachersArray.length
        ? await Teacher.findOne({ user: teachersArray[0] }).populate('user', 'name')
        : null;

      const students = await Student.find({ batch: batch._id })
        .populate('user', '_id name status')
        .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } });

      await Student.updateMany(
        { batch: batch._id },
        {
          ...(teachersChanged ? { teacher: newPrimaryTeacher ? newPrimaryTeacher._id : null } : {}),
          ...(courseChanged ? { course: batch.course } : {})
        }
      );

      const newTeacherName = newPrimaryTeacher?.user?.name || 'Unassigned';
      const notifications = students
        .filter(student => student.user)
        .map(student => {
          const oldTeacherName = student.teacher?.user?.name || 'Unassigned';
          const messages = [];
          if (teachersChanged) {
            messages.push(`your primary teacher changed from ${oldTeacherName} to ${newTeacherName}`);
          }
          if (courseChanged) {
            messages.push('your course assignment was updated to match the batch');
          }

          return Message.create({
            sender: req.user._id,
            recipient: student.user._id,
            content: `Batch "${batch.name}" update: ${messages.join(' and ')}.`
          });
        });

      await Promise.all(notifications);
    }

    logger.info('Batch updated successfully', {
      id: req.params.id,
      name: batch.name
    });

    res.redirect('/admin/batches?updated=1');

  } catch (err) {
    logger.error('postEditBatch Error', {
      err: err.message,
      stack: err.stack
    });

    const [target, allTeachers, courses] = await Promise.all([
      Batch.findById(req.params.id),
      User.find({
        role: 'teacher',
        status: 'active'
      }).select('name email'),
      Course.find({
        isActive: true
      }).sort({ name: 1 })
    ]);

    res.render('admin/batch-form', {
      title: 'Edit Batch',
      user: req.user,
      target,
      teachers: allTeachers,
      courses,
      error: err.message
    });
  }
};


// POST /admin/batches/:id/delete
exports.postDeleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.redirect('/admin/batches');
    }

    const studentCount = await Student.countDocuments({
      batch: batch._id
    });

    if (studentCount > 0) {
      batch.isActive = false;
      await batch.save();

      logger.warn('Batch archived instead of deleted because students exist', {
        id: batch._id,
        studentCount
      });

      return res.redirect('/admin/batches?archived=1');
    }

    await Batch.findByIdAndDelete(req.params.id);

    logger.info('Batch deleted successfully', {
      id: req.params.id,
      name: batch.name
    });

    res.redirect('/admin/batches?deleted=1');

  } catch (err) {
    logger.error('postDeleteBatch Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect('/admin/batches?error=1');
  }
};
