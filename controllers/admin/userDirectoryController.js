const User = require('../../models/User');
const Student = require('../../models/Student');
const Teacher = require('../../models/Teacher');
const Counsellor = require('../../models/Counsellor');
const Course = require('../../models/Course');
const Batch = require('../../models/Batch');
const Fee = require('../../models/Fee');
const Attendance = require('../../models/Attendance');
const Lead = require('../../models/Lead');

const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');
const { USER_STATUSES } = require('../../config/constants');
const { todayIST } = require('../../utils/dateHelper');
const { calculateStudentsAttendance } = require('../../utils/attendanceHelper');
const crypto = require('crypto');

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

async function getCourseRoster(courseId) {
  if (!courseId) return null;
  const course = await Course.findById(courseId).select('name code');
  if (!course) return null;
  const name = `${course.code || course.name} - General`;
  return Batch.findOneAndUpdate(
    { name, course: course._id },
    { $setOnInsert: { name, course: course._id, capacity: 10000, teachers: [], isActive: true } },
    { new: true, upsert: true }
  );
}

async function getUserFormOptions() {
  const [courses, batches, teachers, counsellors] = await Promise.all([
    Course.find({ isActive: true }).sort({ name: 1 }),
    Batch.find({ isActive: true }).populate('course', 'name code').sort({ name: 1 }),
    Teacher.find().populate('user', 'name status profileIncomplete').sort({ createdAt: -1 }),
    Counsellor.find().populate('user', 'name status profileIncomplete').sort({ createdAt: -1 })
  ]);

  return {
    courses,
    batches,
    teachers: teachers.filter(profile => profile.user && (profile.user.status === 'active' || profile.user.profileIncomplete)),
    counsellors: counsellors.filter(profile => profile.user && (profile.user.status === 'active' || profile.user.profileIncomplete))
  };
}

exports.postCreateTemporaryStaff = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const role = req.body.role;
  if (name.length < 2 || name.length > 100 || !['teacher', 'counsellor'].includes(role)) {
    return res.status(400).json({ error: 'Enter a valid staff name and role.' });
  }

  let temporaryUser;
  try {
    temporaryUser = await User.create({
      name,
      email: `pending-${crypto.randomUUID()}@staff.invalid`,
      password: crypto.randomBytes(24).toString('hex'),
      role,
      status: 'inactive',
      profileIncomplete: true,
      mustChangePassword: true,
      firstLoginCompleted: false
    });
    const profile = role === 'teacher'
      ? await Teacher.create({ user: temporaryUser._id })
      : await Counsellor.create({ user: temporaryUser._id });

    res.status(201).json({
      profileId: profile._id,
      userId: temporaryUser._id,
      name,
      role,
      editUrl: `/admin/users/${temporaryUser._id}/edit`
    });
  } catch (err) {
    if (temporaryUser) await User.deleteOne({ _id: temporaryUser._id }).catch(() => {});
    logger.error('Temporary staff creation failed', { error: err.message, role, adminId: req.user._id });
    res.status(500).json({ error: 'Temporary staff could not be created.' });
  }
};


// GET /admin/users
exports.getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 10), 100);
    const skip = (page - 1) * limit;

    const userFilter = { archivedAt: null };
    if (role) {
      userFilter.role = role;
    }

    if (search) {
      const escaped = escapeRegex(search);

      // Search matching courses and batches for students/teachers
      const [matchingCourses, matchingBatches] = await Promise.all([
        Course.find({ name: { $regex: escaped, $options: 'i' } }).select('_id'),
        Batch.find({ name: { $regex: escaped, $options: 'i' } }).select('_id')
      ]);

      const courseIds = matchingCourses.map(c => c._id);
      const batchIds = matchingBatches.map(b => b._id);

      // Find students matching course, batch or rollNumber
      const matchingStudents = await Student.find({
        $or: [
          { rollNumber: { $regex: escaped, $options: 'i' } },
          { course: { $in: courseIds } },
          { batch: { $in: batchIds } }
        ]
      }).select('user');

      // Find teachers matching qualification or rollNumber
      const matchingTeachers = await Teacher.find({
        $or: [
          { rollNumber: { $regex: escaped, $options: 'i' } },
          { qualification: { $regex: escaped, $options: 'i' } }
        ]
      }).select('user');

      const matchedUserIdsFromProfiles = [
        ...matchingStudents.map(s => s.user),
        ...matchingTeachers.map(t => t.user)
      ].filter(Boolean);

      userFilter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { _id: { $in: matchedUserIdsFromProfiles } }
      ];
    }

    const [users, totalUsers] = await Promise.all([
      User.find(userFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(userFilter)
    ]);

    const userIds = users.map(user => user._id);

    // Fetch student profiles for these users
    const studentProfiles = await Student.find({ user: { $in: userIds } })
      .populate('course', 'name code')
      .populate('batch', 'name');

    // Fetch teacher profiles for these users
    const teacherProfiles = await Teacher.find({ user: { $in: userIds } })
      .populate('courses', 'name code');

    const studentProfileMap = new Map(studentProfiles.map(p => [String(p.user), p]));
    const teacherProfileMap = new Map(teacherProfiles.map(p => [String(p.user), p]));

    // Fetch student attendance stats if there are students
    let attendanceMap = new Map();
    const studentsToCalculate = studentProfiles.filter(p => userIds.map(String).includes(String(p.user)));
    if (studentsToCalculate.length > 0) {
      const studentIds = studentsToCalculate.map(s => s._id);
      const [attendanceRecords, todayRecords] = await Promise.all([
        Attendance.find({ student: { $in: studentIds } }),
        Attendance.find({ date: todayIST(), student: { $in: studentIds } })
      ]);

      const studentsForAttendance = studentsToCalculate.map(student => {
        const plain = student.toObject();
        const correspondingUser = users.find(u => String(u._id) === String(student.user));
        plain.name = correspondingUser?.name || '';
        plain.status = correspondingUser?.status || '';
        return plain;
      });

      await calculateStudentsAttendance(studentsForAttendance, attendanceRecords, todayRecords);
      attendanceMap = new Map(
        studentsForAttendance.map(student => [
          String(student._id),
          { attendancePct: student.attendancePct, isMarkedToday: student.isMarkedToday }
        ])
      );
    }

    const mergedUsers = users.map(user => {
      const plainUser = user.toObject();
      const sProfile = studentProfileMap.get(String(user._id));
      const tProfile = teacherProfileMap.get(String(user._id));
      
      const stats = sProfile ? (attendanceMap.get(String(sProfile._id)) || {}) : {};

      return {
        ...plainUser,
        studentProfile: sProfile ? sProfile.toObject() : null,
        teacherProfile: tProfile ? tProfile.toObject() : null,
        rollNumber: sProfile?.rollNumber || tProfile?.rollNumber || plainUser.rollNumber || '',
        attendancePct: typeof stats.attendancePct !== 'undefined' ? stats.attendancePct : 100,
        isMarkedToday: typeof stats.isMarkedToday !== 'undefined' ? stats.isMarkedToday : true,
        idProof: sProfile?.documents?.idProof || null,
        fatherName: sProfile?.family?.father?.name || '',
        guardianPhone: sProfile?.family?.guardian?.phone || '',
        idVerified: sProfile?.idVerified || false,
        qualification: tProfile?.qualification || '',
        experienceYears: tProfile?.experienceYears || 0
      };
    });

    res.render('admin/users', {
      title: 'Manage Users',
      user: req.user,
      users: mergedUsers,
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.max(Math.ceil(totalUsers / limit), 1)
      },
      filter: req.query
    });
  } catch (err) {
    logger.error('Get Users Error', { err: err.message, stack: err.stack });
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
    const formOptions = await getUserFormOptions();

    res.render('admin/user-form', {
      title: 'Add User',
      user: req.user,
      target: null,
      defaultRole: req.query.role || '',
      ...formOptions
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
      const courseRoster = await getCourseRoster(data.course);
      const studentProfile = await Student.create({
        user: newUser._id,
        counsellor: data.counsellor || null,
        teacher: data.teacher || null,
        course: data.course || null,
        batch: courseRoster?._id || null,
        enrollmentDate: data.enrollmentDate || Date.now(),
        highestQualification: data.highestQualification || '',
        referralSource: data.referralSource || '',

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
        salary: Number(data.salary) || 0,
        joiningDate: data.joiningDate || Date.now(),
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

    const [formOptions, studentProfile, teacherProfile, counsellorProfile] = await Promise.all([
      getUserFormOptions(),
      Student.findOne({ user: target._id }),
      Teacher.findOne({ user: target._id }),
      Counsellor.findOne({ user: target._id })
    ]);

    res.render('admin/user-form', {
      title: 'Edit User',
      user: req.user,
      target,
      defaultRole: target.role,
      ...formOptions,
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

    const completingTemporaryStaff = targetUser.profileIncomplete;
    if (completingTemporaryStaff) {
      const email = String(data.email || '').trim().toLowerCase();
      const phone = String(data.phone || '').replace(/\D/g, '').slice(-10);
      if (email.endsWith('.invalid') || email.endsWith('@pending.local') || phone.length !== 10 || String(data.password || '').length < 8) {
        return res.redirect(`/admin/users/${targetUser._id}/edit?incomplete_staff=1`);
      }
      data.phone = phone;
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
    targetUser.socialHandle = {
      ...targetUser.socialHandle?.toObject?.(),
      instagram: data.socialHandle || ''
    };

    if (completingTemporaryStaff) {
      targetUser.password = data.password;
      targetUser.profileIncomplete = false;
      targetUser.status = 'active';
      targetUser.mustChangePassword = true;
      targetUser.passwordSetByAdmin = true;
      targetUser.firstLoginCompleted = false;
    }

    if (req.file) {
      targetUser.profilePic = `/files/${req.file.filename}`;
    }

    await targetUser.save();

    if (targetUser.role === 'student') {
      const courseRoster = await getCourseRoster(data.course);
      const studentUpdate = {
        counsellor: data.counsellor || null,
        teacher: data.teacher || null,
        course: data.course || null,
        batch: courseRoster?._id || null,
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
        highestQualification: data.highestQualification || '',
        referralSource: data.referralSource || ''
      };

      if (data.enrollmentDate) studentUpdate.enrollmentDate = data.enrollmentDate;
      if (data.fees_total !== undefined && data.fees_total !== '') studentUpdate.fees_total = Number(data.fees_total);
      if (data.fees_paid !== undefined && data.fees_paid !== '') studentUpdate.fees_paid = Number(data.fees_paid);
      if (req.file) studentUpdate['documents.profilePic'] = `/files/${req.file.filename}`;

      await Student.findOneAndUpdate(
        { user: targetUser._id },
        studentUpdate,
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
          salary: Number(data.salary) || 0,
          ...(data.joiningDate ? { joiningDate: data.joiningDate } : {}),
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

// POST /admin/users/:id/status
exports.setUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const nextStatus = String(req.body.status || '').trim().toLowerCase();

    if (!user) {
      return res.status(404).redirect('/admin/users?error=User%20not%20found');
    }

    if (!USER_STATUSES.includes(nextStatus)) {
      return res.redirect(getRoleRedirect(user.role, '?error=Invalid%20account%20status'));
    }

    user.status = nextStatus;
    user.archivedAt = nextStatus === 'inactive' ? (user.archivedAt || new Date()) : null;
    await user.save();

    logger.info('Admin updated user status', {
      userId: user._id,
      role: user.role,
      status: nextStatus
    });

    return res.redirect(getRoleRedirect(user.role, '?updated=1'));
  } catch (err) {
    logger.error('setUserStatus Error', { err: err.message, userId: req.params.id });
    return res.redirect('/admin/users?error=Unable%20to%20update%20status');
  }
};

exports.bulkArchiveUsers = async (req, res) => {
  try {
    const submitted = Array.isArray(req.body.userIds) ? req.body.userIds : [req.body.userIds];
    const userIds = [...new Set(submitted.filter(id => /^[0-9a-fA-F]{24}$/.test(String(id || ''))))].slice(0, 500);
    const returnTo = ['/admin/students', '/admin/teachers', '/admin/counsellors', '/admin/users'].includes(req.body.returnTo)
      ? req.body.returnTo
      : '/admin/users';
    if (!userIds.length) return res.redirect(`${returnTo}?error=Select+at+least+one+account+to+archive`);

    const result = await User.updateMany(
      { _id: { $in: userIds }, role: { $ne: 'admin' } },
      { $set: { status: 'inactive', isActive: false, archivedAt: new Date(), tokenBlacklistedBefore: new Date() } }
    );
    return res.redirect(`${returnTo}?archived=${result.modifiedCount}&protected=${userIds.length - result.matchedCount}`);
  } catch (err) {
    logger.error('Bulk Archive Users Error', { err: err.message });
    return res.redirect('/admin/users?error=Unable+to+archive+selected+accounts');
  }
};

exports.getRecycleBin = async (req, res) => {
  try {
    const [users, leads] = await Promise.all([
      User.find({ archivedAt: { $ne: null }, role: { $ne: 'admin' } }).sort({ archivedAt: -1 }),
      Lead.find({ archivedAt: { $ne: null } }).sort({ archivedAt: -1 })
    ]);
    return res.render('admin/recycle-bin', { title: 'Recycle Bin', user: req.user, users, leads });
  } catch (err) {
    logger.error('Get Recycle Bin Error', { err: err.message });
    return res.redirect('/admin/users?error=Unable+to+open+recycle+bin');
  }
};

exports.restoreUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, archivedAt: { $ne: null }, role: { $ne: 'admin' } });
    if (!user) return res.redirect('/admin/users/bin?error=Account+not+found+in+recycle+bin');
    user.status = 'active';
    user.isActive = true;
    user.archivedAt = null;
    user.tokenBlacklistedBefore = new Date();
    await user.save();
    return res.redirect('/admin/users/bin?restored=1');
  } catch (err) {
    logger.error('Restore User Error', { err: err.message });
    return res.redirect('/admin/users/bin?error=Unable+to+restore+account');
  }
};

exports.restoreLead = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, archivedAt: { $ne: null } });
    if (!lead) return res.redirect('/admin/users/bin?error=Lead+not+found+in+recycle+bin');
    lead.archivedAt = null;
    await lead.save();
    return res.redirect('/admin/users/bin?restored=1');
  } catch (err) {
    logger.error('Restore Lead Error', { err: err.message });
    return res.redirect('/admin/users/bin?error=Unable+to+restore+lead');
  }
};
