const User = require('../../models/User');
const Teacher = require('../../models/Teacher');
const Curriculum = require('../../models/Curriculum');
const DailyUpdate = require('../../models/DailyUpdate');
const Schedule = require('../../models/Schedule');
const Message = require('../../models/Message');

const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');


// GET /admin/teachers
exports.getTeachers = async (req, res) => {
  try {
    const { search } = req.query;

    const userFilter = {
      role: 'teacher'
    };

    if (search) {
      const escaped = escapeRegex(search);

      userFilter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } }
      ];
    }

    const users = await User.find(userFilter).sort({ createdAt: -1 });
    const userIds = users.map(user => user._id);

    const teacherProfiles = await Teacher.find({
      userId: { $in: userIds }
    }).populate('userId', 'name email phone status profilePic');

    const teacherProfileMap = new Map(
      teacherProfiles.map(profile => [
        String(profile.userId._id),
        profile
      ])
    );

    const mergedTeachers = users.map(user => {
      const plainUser = user.toObject();
      const profile = teacherProfileMap.get(String(user._id));

      return {
        ...plainUser,
        teacherProfile: profile || null,
        rollNumber: profile?.rollNumber || plainUser.rollNumber || '',
        qualification: profile?.qualification || '',
        experienceYears: profile?.experienceYears || 0
      };
    });

    res.render('admin/users', {
      title: 'Manage Teachers',
      user: req.user,
      users: mergedTeachers,
      roleActive: 'teacher',
      page: 'teachers',
      filter: req.query
    });

  } catch (err) {
    logger.error('getTeachers Error', {
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


// GET /admin/teachers/:id
exports.getTeacherProfile = async (req, res) => {
  try {
    const teacherUser = await User.findById(req.params.id);

    if (!teacherUser || teacherUser.role !== 'teacher') {
      return res.redirect('/admin/teachers');
    }

    const teacherProfile = await Teacher.findOne({
      userId: teacherUser._id
    });

    const [curricula, updates, schedules, messages] = await Promise.all([

      Curriculum.find({ teacher: teacherUser._id })
        .populate('course', 'name code')
        .populate('batch', 'name'),

      DailyUpdate.find({ teacher: teacherUser._id })
        .populate('course', 'name code')
        .populate('batch', 'name')
        .sort({ date: -1 }),

      Schedule.find({ teacher: teacherUser._id })
        .populate('course', 'name code')
        .populate('batch', 'name')
        .populate('classroom', 'name')
        .sort({ date: 1, startTime: 1 }),

      Message.find({ recipient: teacherUser._id })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 })

    ]);

    const teacher = {
      ...teacherUser.toObject(),
      teacherProfile,
      rollNumber: teacherProfile?.rollNumber || teacherUser.rollNumber || '',
      qualification: teacherProfile?.qualification || '',
      experienceYears: teacherProfile?.experienceYears || 0
    };

    res.render('admin/teacher-profile', {
      title: `${teacherUser.name} — Profile`,
      user: req.user,
      teacher,
      curricula,
      updates,
      schedules,
      messages
    });

  } catch (err) {
    logger.error('Teacher Profile Fetch Error', {
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