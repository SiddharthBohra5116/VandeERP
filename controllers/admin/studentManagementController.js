const User = require('../../models/User');
const Student = require('../../models/Student');
const Fee = require('../../models/Fee');
const Attendance = require('../../models/Attendance');
const Progress = require('../../models/Progress');
const Lead = require('../../models/Lead');
const Message = require('../../models/Message');
const Schedule = require('../../models/Schedule');
const Course = require('../../models/Course');

const { todayIST } = require('../../utils/dateHelper');
const { calculateStudentsAttendance } = require('../../utils/attendanceHelper');
const { escapeRegex, phoneSearchPattern } = require('../../utils/sanitize');
const logger = require('../../utils/logger');
const calculateCourseProgress = require('../../utils/courseProgress');
const syncCourseCompletion = require('../../utils/syncCourseCompletion');
const { USER_STATUSES } = require('../../config/constants');


// GET /admin/students
exports.getStudents = async (req, res) => {
  try {
    const modules = res.locals.modules || {};
    const attendanceEnabled = modules.attendance !== false;
    const teacherEnabled = modules.teachers !== false;
    const counsellorEnabled = modules.counsellors !== false;
    const coursesEnabled = modules.courses !== false;
    const batchesEnabled = modules.batches !== false;
    const feesEnabled = modules.fees !== false;
    const leadsEnabled = modules.leads !== false;
    const kycEnabled = modules.kyc !== false;
    const { search, incomplete, status } = req.query;
    const attendance = attendanceEnabled ? req.query.attendance : '';
    const kyc = kycEnabled ? req.query.kyc : '';
    const course = coursesEnabled && /^[a-f\d]{24}$/i.test(req.query.course || '') ? req.query.course : '';
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 10), 100);
    const skip = (page - 1) * limit;

    const userFilter = {
      role: 'student',
      archivedAt: null
    };
    if (status) {
      userFilter.status = status;
      if (status === 'active') userFilter.isActive = { $ne: false };
    }
    const incompleteConditions = [
      ...(batchesEnabled ? [{ batch: null }] : []),
      ...(teacherEnabled ? [{ teacher: null }] : []),
      ...(counsellorEnabled ? [{ counsellor: null }] : [])
    ];
    const incompleteProfileFilter = incompleteConditions.length ? { $or: incompleteConditions } : { _id: null };
    const completeProfileFilter = Object.fromEntries(incompleteConditions.map(condition => [Object.keys(condition)[0], { $ne: null }]));
    const incompleteCount = incompleteConditions.length ? await Student.countDocuments(incompleteProfileFilter) : 0;

    if (incomplete === '1' || incomplete === '0' || kyc || course) {
      const profileFilter = {};
      if (incomplete === '1') Object.assign(profileFilter, incompleteProfileFilter);
      if (incomplete === '0') Object.assign(profileFilter, completeProfileFilter);
      if (kyc === 'complete') profileFilter.idVerified = true;
      if (kyc === 'pending') profileFilter.idVerified = { $ne: true };
      if (course) profileFilter.course = course;
      const matchingProfiles = await Student.find(profileFilter).select('user');
      userFilter._id = { $in: matchingProfiles.map(profile => profile.user).filter(Boolean) };
    }

    if (search) {
      const escaped = escapeRegex(search);
      const phonePattern = phoneSearchPattern(search);

      const Batch = require('../../models/Batch');

      const [matchingCourses, matchingBatches] = await Promise.all([
        coursesEnabled ? Course.find({ name: { $regex: escaped, $options: 'i' } }).select('_id') : [],
        batchesEnabled ? Batch.find({ name: { $regex: escaped, $options: 'i' } }).select('_id') : []
      ]);

      const courseIds = matchingCourses.map(c => c._id);
      const batchIds = matchingBatches.map(b => b._id);

      const matchingStudents = await Student.find({
        $or: [
          { rollNumber: { $regex: escaped, $options: 'i' } },
          { course: { $in: courseIds } },
          { batch: { $in: batchIds } }
        ]
      }).select('user');

      const matchedUserIdsFromProfiles = matchingStudents.map(s => s.user).filter(Boolean);

      userFilter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: phonePattern, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { _id: { $in: matchedUserIdsFromProfiles } }
      ];
    }

    let [users, totalUsers] = await Promise.all([
      attendance ? User.find(userFilter).sort({ createdAt: -1 }) : User.find(userFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(userFilter)
    ]);

    const userIds = users.map(user => user._id);

    let profilesQuery = Student.find({ user: { $in: userIds } }).populate('user', 'name email phone status profilePic');
    if (coursesEnabled) profilesQuery = profilesQuery.populate('course', 'name code');
    if (batchesEnabled) profilesQuery = profilesQuery.populate('batch', 'name');
    if (teacherEnabled) profilesQuery = profilesQuery.populate({ path: 'teacher', populate: { path: 'user', select: 'name' } });
    if (counsellorEnabled) profilesQuery = profilesQuery.populate({ path: 'counsellor', populate: { path: 'user', select: 'name' } });
    const studentProfiles = await profilesQuery.sort({ createdAt: -1 });

    const studentProfileMap = new Map(
      studentProfiles
        .filter(profile => profile.user)
        .map(profile => [
          String(profile.user._id),
          profile
        ])
    );
    const fees = feesEnabled ? await Fee.find({ student: { $in: studentProfiles.map(profile => profile._id) } }).select('student totalAmount paidAmount') : [];
    const feeMap = new Map(fees.map(fee => [String(fee.student), fee]));
    const leads = leadsEnabled ? await Lead.find({ convertedStudent: { $in: studentProfiles.map(profile => profile._id) } }).select('convertedStudent source referredBy') : [];
    const leadMap = new Map(leads.map(lead => [String(lead.convertedStudent), lead]));

    let attendanceMap = new Map();

    if (attendanceEnabled && studentProfiles.length > 0) {
      const studentIds = studentProfiles.map(student => student._id);

      const [attendanceRecords, todayRecords] = await Promise.all([
        Attendance.find({ student: { $in: studentIds } }),
        Attendance.find({
          date: todayIST(),
          student: { $in: studentIds }
        })
      ]);

      const studentsForAttendance = studentProfiles.map(student => {
        const plain = student.toObject();

        plain.name = student.user?.name || '';
        plain.status = student.user?.status || '';

        return plain;
      });

      await calculateStudentsAttendance(
        studentsForAttendance,
        attendanceRecords,
        todayRecords
      );

      attendanceMap = new Map(
        studentsForAttendance.map(student => [
          String(student._id),
          {
            attendancePct: student.attendancePct,
            isMarkedToday: student.isMarkedToday
          }
        ])
      );
    }

    let mergedStudents = users.map(user => {
      const plainUser = user.toObject();
      const profile = studentProfileMap.get(String(user._id));
      const stats = profile ? (attendanceMap.get(String(profile._id)) || {}) : {};
      const fee = profile ? feeMap.get(String(profile._id)) : null;
      const lead = profile ? leadMap.get(String(profile._id)) : null;

      return {
        ...plainUser,
        studentProfile: profile ? profile.toObject() : null,
        rollNumber: profile?.rollNumber || plainUser.rollNumber || '',
        attendancePct: typeof stats.attendancePct !== 'undefined' ? stats.attendancePct : 0,
        isMarkedToday: typeof stats.isMarkedToday !== 'undefined' ? stats.isMarkedToday : true,
        idProof: profile?.documents?.idProof || null,
        fatherName: profile?.family?.father?.name || '',
        guardianPhone: profile?.family?.guardian?.phone || '',
        idVerified: profile?.idVerified || false,
        feeTotal: fee?.totalAmount ?? profile?.fees_total ?? 0,
        feePaid: fee?.paidAmount ?? profile?.fees_paid ?? 0,
        leadSource: lead?.source || '',
        referredBy: lead?.referredBy || ''
      };
    });

    if (attendance) {
      mergedStudents = mergedStudents.filter(student => {
        if (attendance === 'low') return student.attendancePct < 75;
        if (attendance === 'medium') return student.attendancePct >= 75 && student.attendancePct <= 85;
        if (attendance === 'high') return student.attendancePct > 85;
        if (attendance === 'not_marked_today') return !student.isMarkedToday;
        return true;
      });
      totalUsers = mergedStudents.length;
      mergedStudents = mergedStudents.slice(skip, skip + limit);
    }

    const courses = coursesEnabled ? await Course.find({ isActive: true }).select('name code').sort({ name: 1 }).lean() : [];

    res.render('admin/users', {
      title: 'Manage Students',
      user: req.user,
      users: mergedStudents,
      roleActive: 'student',
      page: 'students',
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.max(Math.ceil(totalUsers / limit), 1)
      },
      filter: req.query,
      courses,
      incompleteCount
    });

  } catch (err) {
    logger.error('getStudents Error', {
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




// GET /admin/students/:id
exports.getStudentProfile = async (req, res) => {
  try {
    const modules = res.locals.modules || {};
    const attendanceEnabled = modules.attendance !== false;
    const teacherEnabled = modules.teachers !== false;
    const counsellorEnabled = modules.counsellors !== false;
    const coursesEnabled = modules.courses !== false;
    const batchesEnabled = modules.batches !== false;
    const feesEnabled = modules.fees !== false;
    const leadsEnabled = modules.leads !== false;
    const progressEnabled = modules.progress !== false;
    const schedulesEnabled = modules.schedules !== false;
    let studentQuery = Student.findById(req.params.id)
      .populate('user', 'name email phone status profilePic address city dob socialHandle createdAt updatedAt');
    if (teacherEnabled) studentQuery = studentQuery.populate({ path: 'teacher', populate: { path: 'user', select: 'name email phone' } });
    if (counsellorEnabled) studentQuery = studentQuery.populate({ path: 'counsellor', populate: { path: 'user', select: 'name email phone' } });
    if (coursesEnabled) studentQuery = studentQuery.populate('course', 'name code durationMonths fees requiredClasses');
    if (batchesEnabled) studentQuery = studentQuery.populate('batch', 'name');
    const student = await studentQuery;

    if (!student || !student.user) {
      return res.redirect('/admin/students');
    }

    const [fee, attendance, progress, lead, messages, futureSchedules] = await Promise.all([
      feesEnabled ? Fee.findOne({ student: student._id }).populate('payments.receivedBy', 'name') : null,

      attendanceEnabled ? (() => {
        let query = Attendance.find({ student: student._id }).sort({ date: -1 });
        if (teacherEnabled) query = query.populate({ path: 'teacher', populate: { path: 'user', select: 'name' } });
        return query;
      })() : [],

      progressEnabled ? (() => {
        let query = Progress.findOne({ student: student._id }).populate('course', 'name code').populate('batch', 'name');
        if (teacherEnabled) query = query.populate({ path: 'teacher', populate: { path: 'user', select: 'name' } });
        return query;
      })() : null,

      leadsEnabled ? Lead.findOne({ convertedStudent: student._id })
        .populate({ path: 'assignedTo', populate: { path: 'user', select: 'name' } }) : null,

      Message.find({ recipient: student.user._id })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 }),

      schedulesEnabled && batchesEnabled && student.batch ? Schedule.find({ batch: student.batch._id, date: { $gte: todayIST() }, status: { $ne: 'cancelled' } }).select('date').sort({ date: 1 }).lean() : []
    ]);

    const courseProgress = calculateCourseProgress(student, attendance, futureSchedules);

    res.render('admin/student-profile', {
      title: `${student.user.name} — Profile`,
      user: req.user,
      student,
      fee,
      attendance,
      progress,
      lead,
      messages,
      courseProgress
    });

  } catch (err) {
    logger.error('Student Profile Fetch Error', {
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

exports.postUpdateClassTarget = async (req, res) => {
  try {
    const target = parseInt(req.body.requiredClassesOverride, 10);
    if (!Number.isInteger(target) || target < 0 || target > 1000) throw new Error('Class target must be between 0 and 1000.');
    await Student.findByIdAndUpdate(req.params.id, { requiredClassesOverride: target }, { runValidators: true });
    await syncCourseCompletion([req.params.id], req.user._id);
    res.redirect(`/admin/students/${req.params.id}?class_target_saved=1`);
  } catch (err) {
    res.redirect(`/admin/students/${req.params.id}?error=${encodeURIComponent(err.message)}`);
  }
};


// POST /admin/students/:id/verify-id
exports.postVerifyStudentId = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.redirect('/admin/students');
    }

    student.idVerified = true;
    await student.save();

    // Send chat message to student
    try {
      await Message.create({
        sender: req.user._id,
        recipient: student.user,
        content: "Your document verification request has been approved. Your ID proof is verified successfully."
      });
    } catch (msgErr) {
      logger.error('Failed to send verification approval message', { err: msgErr.message });
    }

    res.redirect(`/admin/students/${student._id}?verified=1`);

  } catch (err) {
    logger.error('Verify Student ID Error', { err: err.message });
    res.redirect(`/admin/students/${req.params.id}?error=1`);
  }
};

// POST /admin/students/bulk-verify-id
exports.postBulkVerifyStudentIds = async (req, res) => {
  try {
    const selectedIds = Array.isArray(req.body.studentIds)
      ? req.body.studentIds
      : req.body.studentIds ? [req.body.studentIds] : [];

    if (selectedIds.length === 0) {
      return res.redirect('/admin/students?error=no_students_selected');
    }

    const verifiedStudents = await Student.find({
      _id: { $in: selectedIds },
      'documents.idProof': { $nin: [null, ''] }
    }).select('user');

    const result = await Student.updateMany(
      {
        _id: { $in: selectedIds },
        'documents.idProof': { $nin: [null, ''] }
      },
      { $set: { idVerified: true } }
    );

    // Send chat message to all verified students
    if (verifiedStudents.length > 0) {
      try {
        const messagePromises = verifiedStudents.map(s => {
          return Message.create({
            sender: req.user._id,
            recipient: s.user,
            content: "Your document verification request has been approved. Your ID proof is verified successfully."
          });
        });
        await Promise.all(messagePromises);
      } catch (msgErr) {
        logger.error('Failed to send bulk verification approval messages', { err: msgErr.message });
      }
    }

    logger.info('Bulk student ID verification completed', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });

    res.redirect(`/admin/students?bulk_verified=${result.modifiedCount || 0}`);
  } catch (err) {
    logger.error('Bulk Verify Student IDs Error', { err: err.message });
    res.redirect('/admin/students?error=bulk_verify_failed');
  }
};


// POST /admin/students/:id/remark
exports.postAddStudentRemark = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.redirect('/admin/students');
    }

    if (!student.remarks) {
      student.remarks = [];
    }

    student.remarks.push({
      postedBy: req.user._id,
      role: req.user.role,
      note: req.body.note
    });

    await student.save();

    res.redirect(`/admin/students/${student._id}?updated=1`);

  } catch (err) {
    logger.error('Add Student Remark Error', { err: err.message });
    res.redirect(`/admin/students/${req.params.id}?error=1`);
  }
};


// POST /admin/students/:id/status
exports.postUpdateStudentStatus = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('user');
    const nextStatus = String(req.body.status || '').trim().toLowerCase();

    if (!student || !student.user) {
      return res.redirect('/admin/students');
    }
    if (!USER_STATUSES.includes(nextStatus)) {
      return res.redirect(`/admin/students/${student._id}?error=Invalid%20student%20status`);
    }

    student.user.status = nextStatus;
    student.user.isActive = !['inactive', 'drop'].includes(nextStatus);
    student.user.archivedAt = nextStatus === 'inactive' ? (student.user.archivedAt || new Date()) : null;

    await student.user.save();

    if (!student.statusHistory) {
      student.statusHistory = [];
    }

    student.statusHistory.push({
      status: nextStatus,
      changedBy: req.user._id,
      reason: req.body.reason || 'Manual status change'
    });

    await student.save();

    res.redirect(nextStatus === 'complete'
      ? '/admin/students?status=complete&updated=1'
      : `/admin/students/${student._id}?updated=1`);

  } catch (err) {
    logger.error('Update Student Status Error', { err: err.message });
    res.redirect(`/admin/students/${req.params.id}?error=1`);
  }
};
