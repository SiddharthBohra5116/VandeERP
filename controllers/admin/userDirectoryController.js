const User = require('../../models/User');
const Student = require('../../models/Student');
const Teacher = require('../../models/Teacher');
const Counsellor = require('../../models/Counsellor');
const Course = require('../../models/Course');
const Batch = require('../../models/Batch');
const Fee = require('../../models/Fee');

const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');

function getRoleRedirect(role, queryParams = '') {
  const map = {
    student: '/admin/students',
    teacher: '/admin/teachers',
    counsellor: '/admin/counsellors',
    admin: '/admin/users'
  };

  const base = map[role] || '/admin/dashboard';
  return queryParams ? `${base}${queryParams}` : base;
}


// GET /admin/users
exports.getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 10), 100);
    const skip = (page - 1) * limit;

    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (search) {
      filter.name = {
        $regex: escapeRegex(search),
        $options: 'i'
      };
    }

    const [users, totalUsers] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter)
    ]);

    res.render('admin/users', {
      title: 'Manage Users',
      user: req.user,
      users,
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.max(Math.ceil(totalUsers / limit), 1)
      },
      filter: req.query
    });

  } catch (err) {
    logger.error('Get Users Error', { err: err.message });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};


// GET /admin/users/create
exports.getCreateUser = async (req, res) => {
  try {
    const [courses, batches] = await Promise.all([
      Course.find({ isActive: true }).sort({ name: 1 }),
      Batch.find({ isActive: true }).populate('course', 'name code').sort({ name: 1 })
    ]);

    res.render('admin/user-form', {
      title: 'Add User',
      user: req.user,
      target: null,
      defaultRole: req.query.role || '',
      courses,
      batches
    });

  } catch (err) {
    logger.error('getCreateUser Error', { err: err.message });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};


// POST /admin/users/create
exports.postCreateUser = async (req, res) => {
  const data = { ...req.body };

  logger.info('Create User request received', {
    name: data.name,
    role: data.role,
    email: data.email
  });

  try {
    const [courses, batches] = await Promise.all([
      Course.find({ isActive: true }).sort({ name: 1 }),
      Batch.find({ isActive: true }).populate('course', 'name code').sort({ name: 1 })
    ]);

    if (data.email) {
      const email = data.email.trim().toLowerCase();

      const existingUser = await User.findOne({ email });

      if (existingUser) {
        return res.render('admin/user-form', {
          title: 'Add User',
          user: req.user,
          target: null,
          defaultRole: data.role || '',
          courses,
          batches,
          error: 'This email address is already registered.'
        });
      }

      data.email = email;
    }

    const userPayload = {
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      phone: data.phone || '',
      status: data.status || 'active',
      address: data.address || '',
      city: data.city || '',
      dob: data.dob || null,
      mustChangePassword: true,
      passwordSetByAdmin: true,
      firstLoginCompleted: false
    };

    if (req.file) {
      userPayload.profilePic = `/files/${req.file.filename}`;
    }

    const newUser = await User.create(userPayload);

    if (newUser.role === 'student') {
      const studentProfile = await Student.create({
        user: newUser._id,
        counsellor: data.counsellor || null,
        teacher: data.teacher || null,
        course: data.course || null,
        batch: data.batch || null,
        enrollmentDate: data.enrollmentDate || Date.now(),

        fees_total: Number(data.fees_total) || 0,
        fees_paid: Number(data.fees_paid) || 0,

        family: {
          father: {
            name: data.fatherName || '',
            phone: data.fatherPhone || ''
          },
          mother: {
            name: data.motherName || '',
            phone: data.motherPhone || ''
          },
          guardian: {
            name: data.guardianName || '',
            relation: data.guardianRelation || '',
            phone: data.guardianPhone || ''
          }
        },

        documents: {
          profilePic: req.file ? `/files/${req.file.filename}` : null,
          idProof: data.idProof || null
        }
      });

      const totalAmount = Number(data.fees_total) || 0;
      const paidAmount = Number(data.fees_paid) || 0;

      if (totalAmount > 0) {
        const courseDoc = data.course
          ? await Course.findById(data.course)
          : null;

        const feeLedger = new Fee({
          student: studentProfile._id,
          course: data.course,
          batch: data.batch || null,
          totalAmount,
          paidAmount,
          courseDurationMonths: courseDoc?.durationMonths || 3,
          payments: paidAmount > 0 ? [{
            amount: paidAmount,
            method: 'Cash',
            note: 'Initial down payment',
            receivedBy: req.user._id,
            paidAt: new Date()
          }] : []
        });

        feeLedger.generateInstallments();
        feeLedger.allocatePayments();

        await feeLedger.save();
      }
    }

    if (newUser.role === 'teacher') {
      await Teacher.create({
        user: newUser._id,
        qualification: data.qualification || '',
        experienceYears: Number(data.experienceYears) || 0,
        courses: data.course ? [data.course] : []
      });
    }

    if (newUser.role === 'counsellor') {
      await Counsellor.create({
        user: newUser._id
      });
    }

    logger.info('User created successfully', {
      userId: newUser._id,
      role: newUser.role
    });

    res.redirect(getRoleRedirect(newUser.role, '?created=1'));

  } catch (err) {
    logger.error('Create User Error', {
      err: err.message,
      stack: err.stack
    });

    const [courses, batches] = await Promise.all([
      Course.find({ isActive: true }).sort({ name: 1 }),
      Batch.find({ isActive: true }).populate('course', 'name code').sort({ name: 1 })
    ]);

    res.render('admin/user-form', {
      title: 'Add User',
      user: req.user,
      target: null,
      defaultRole: req.body.role || '',
      courses,
      batches,
      error: err.message
    });
  }
};


// GET /admin/users/:id/edit
exports.getEditUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);

    if (!target) {
      return res.redirect('/admin/dashboard');
    }

    const [courses, batches, studentProfile, teacherProfile, counsellorProfile] = await Promise.all([
      Course.find({ isActive: true }).sort({ name: 1 }),
      Batch.find({ isActive: true }).populate('course', 'name code').sort({ name: 1 }),
      Student.findOne({ user: target._id }),
      Teacher.findOne({ user: target._id }),
      Counsellor.findOne({ user: target._id })
    ]);

    res.render('admin/user-form', {
      title: 'Edit User',
      user: req.user,
      target,
      defaultRole: target.role,
      courses,
      batches,
      studentProfile,
      teacherProfile,
      counsellorProfile
    });

  } catch (err) {
    logger.error('getEditUser Error', { err: err.message });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};


// POST /admin/users/:id/edit
exports.postEditUser = async (req, res) => {
  const data = { ...req.body };

  logger.info('Edit User request received', {
    userId: req.params.id,
    name: data.name,
    role: data.role
  });

  try {
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.redirect('/admin/dashboard');
    }

    if (data.email) {
      const email = data.email.trim().toLowerCase();

      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.params.id }
      });

      if (existingUser) {
        const [courses, batches, studentProfile, teacherProfile, counsellorProfile] = await Promise.all([
          Course.find({ isActive: true }).sort({ name: 1 }),
          Batch.find({ isActive: true }).populate('course', 'name code').sort({ name: 1 }),
          Student.findOne({ user: targetUser._id }),
          Teacher.findOne({ user: targetUser._id }),
          Counsellor.findOne({ user: targetUser._id })
        ]);

        return res.render('admin/user-form', {
          title: 'Edit User',
          user: req.user,
          target: targetUser,
          defaultRole: targetUser.role,
          courses,
          batches,
          studentProfile,
          teacherProfile,
          counsellorProfile,
          error: 'This email address is already registered.'
        });
      }

      targetUser.email = email;
    }

    targetUser.name = data.name || targetUser.name;
    targetUser.phone = data.phone || '';
    targetUser.status = data.status || targetUser.status;
    targetUser.address = data.address || '';
    targetUser.city = data.city || '';
    targetUser.dob = data.dob || null;

    if (req.file) {
      targetUser.profilePic = `/files/${req.file.filename}`;
    }

    await targetUser.save();

    if (targetUser.role === 'student') {
      await Student.findOneAndUpdate(
        { user: targetUser._id },
        {
          counsellor: data.counsellor || null,
          teacher: data.teacher || null,
          course: data.course || null,
          batch: data.batch || null,
          enrollmentDate: data.enrollmentDate || Date.now(),

          fees_total: Number(data.fees_total) || 0,
          fees_paid: Number(data.fees_paid) || 0,

          family: {
            father: {
              name: data.fatherName || '',
              phone: data.fatherPhone || ''
            },
            mother: {
              name: data.motherName || '',
              phone: data.motherPhone || ''
            },
            guardian: {
              name: data.guardianName || '',
              relation: data.guardianRelation || '',
              phone: data.guardianPhone || ''
            }
          },

          ...(req.file ? {
            'documents.profilePic': `/files/${req.file.filename}`
          } : {})
        },
        {
          new: true,
          upsert: true
        }
      );
    }

    if (targetUser.role === 'teacher') {
      await Teacher.findOneAndUpdate(
        { user: targetUser._id },
        {
          qualification: data.qualification || '',
          experienceYears: Number(data.experienceYears) || 0,
          courses: data.course ? [data.course] : []
        },
        {
          new: true,
          upsert: true
        }
      );
    }

    if (targetUser.role === 'counsellor') {
      await Counsellor.findOneAndUpdate(
        { user: targetUser._id },
        {},
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
    }

    logger.info('User updated successfully', {
      userId: req.params.id,
      status: targetUser.status
    });

    res.redirect(getRoleRedirect(targetUser.role, '?updated=1'));

  } catch (err) {
    logger.error('Edit User Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect(getRoleRedirect(data.role || 'student', `?error=1`));
  }
};


// POST /admin/users/:id/toggle
exports.toggleUserStatus = async (req, res) => {
  logger.info('Toggle user status request received', {
    userId: req.params.id
  });

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.redirect('/admin/dashboard');
    }

    user.status = user.status === 'active' ? 'inactive' : 'active';

    await user.save();

    logger.info('User status toggled successfully', {
      userId: req.params.id,
      status: user.status
    });

    res.redirect(getRoleRedirect(user.role));

  } catch (err) {
    logger.error('toggleUserStatus Error', { err: err.message });
    res.redirect('/admin/dashboard?error=1');
  }
};
