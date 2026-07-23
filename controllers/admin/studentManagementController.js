const User = require('../../models/User');
const Student = require('../../models/Student');
const Fee = require('../../models/Fee');
const Attendance = require('../../models/Attendance');
const Progress = require('../../models/Progress');
const Lead = require('../../models/Lead');
const Message = require('../../models/Message');
const Schedule = require('../../models/Schedule');

const { todayIST } = require('../../utils/dateHelper');
const { calculateStudentsAttendance } = require('../../utils/attendanceHelper');
const { escapeRegex, phoneSearchPattern } = require('../../utils/sanitize');
const logger = require('../../utils/logger');
const calculateCourseProgress = require('../../utils/courseProgress');
const syncCourseCompletion = require('../../utils/syncCourseCompletion');


// GET /admin/students
exports.getStudents = async (req, res) => {
  try {
    const { search, attendance, incomplete, status, kyc } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 10), 100);
    const skip = (page - 1) * limit;

    const userFilter = {
      role: 'student',
      archivedAt: null
    };
    if (status) userFilter.status = status;
    const incompleteProfileFilter = { $or: [{ batch: null }, { teacher: null }, { counsellor: null }] };
    const incompleteCount = await Student.countDocuments(incompleteProfileFilter);

    if (incomplete === '1' || incomplete === '0' || kyc) {
      const profileFilter = {};
      if (incomplete === '1') Object.assign(profileFilter, incompleteProfileFilter);
      if (incomplete === '0') Object.assign(profileFilter, { batch: { $ne: null }, teacher: { $ne: null }, counsellor: { $ne: null } });
      if (kyc === 'complete') profileFilter.idVerified = true;
      if (kyc === 'pending') profileFilter.idVerified = { $ne: true };
      const matchingProfiles = await Student.find(profileFilter).select('user');
      userFilter._id = { $in: matchingProfiles.map(profile => profile.user).filter(Boolean) };
    }

    if (search) {
      const escaped = escapeRegex(search);
      const phonePattern = phoneSearchPattern(search);

      const Course = require('../../models/Course');
      const Batch = require('../../models/Batch');

      const [matchingCourses, matchingBatches] = await Promise.all([
        Course.find({ name: { $regex: escaped, $options: 'i' } }).select('_id'),
        Batch.find({ name: { $regex: escaped, $options: 'i' } }).select('_id')
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

    const studentProfiles = await Student.find({
      user: { $in: userIds }
    })
      .populate('user', 'name email phone status profilePic')
      .populate('course', 'name code')
      .populate('batch', 'name')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'counsellor', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 });

    const studentProfileMap = new Map(
      studentProfiles
        .filter(profile => profile.user)
        .map(profile => [
          String(profile.user._id),
          profile
        ])
    );
    const fees = await Fee.find({ student: { $in: studentProfiles.map(profile => profile._id) } }).select('student totalAmount paidAmount');
    const feeMap = new Map(fees.map(fee => [String(fee.student), fee]));
    const leads = await Lead.find({ convertedStudent: { $in: studentProfiles.map(profile => profile._id) } }).select('convertedStudent source referredBy');
    const leadMap = new Map(leads.map(lead => [String(lead.convertedStudent), lead]));

    let attendanceMap = new Map();

    if (studentProfiles.length > 0) {
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
    const student = await Student.findById(req.params.id)
      .populate('user', 'name email phone status profilePic address city dob socialHandle createdAt updatedAt')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name email phone' } })
      .populate({ path: 'counsellor', populate: { path: 'user', select: 'name email phone' } })
      .populate('course', 'name code durationMonths fees requiredClasses')
      .populate('batch', 'name');

    if (!student || !student.user) {
      return res.redirect('/admin/students');
    }

    const [fee, attendance, progress, lead, messages, futureSchedules] = await Promise.all([
      Fee.findOne({ student: student._id })
        .populate('payments.receivedBy', 'name'),

      Attendance.find({ student: student._id })
        .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
        .sort({ date: -1 }),

      Progress.findOne({ student: student._id })
        .populate({ path: 'teacher', populate: { path: 'user', select: 'name' } })
        .populate('course', 'name code')
        .populate('batch', 'name'),

      Lead.findOne({ convertedStudent: student._id })
        .populate({ path: 'assignedTo', populate: { path: 'user', select: 'name' } }),

      Message.find({ recipient: student.user._id })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 }),

      student.batch ? Schedule.find({ batch: student.batch._id, date: { $gte: todayIST() }, status: { $ne: 'cancelled' } }).select('date').sort({ date: 1 }).lean() : []
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

    if (!student || !student.user) {
      return res.redirect('/admin/students');
    }

    student.user.status = req.body.status;

    await student.user.save();

    if (!student.statusHistory) {
      student.statusHistory = [];
    }

    student.statusHistory.push({
      status: req.body.status,
      changedBy: req.user._id,
      reason: req.body.reason || 'Manual status change'
    });

    await student.save();

    res.redirect(`/admin/students/${student._id}?updated=1`);

  } catch (err) {
    logger.error('Update Student Status Error', { err: err.message });
    res.redirect(`/admin/students/${req.params.id}?error=1`);
  }
};
