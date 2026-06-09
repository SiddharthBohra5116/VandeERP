const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const Curriculum = require('../../models/Curriculum');
const DailyUpdate = require('../../models/DailyUpdate');
const Schedule = require('../../models/Schedule');
const Message = require('../../models/Message');
const Fee = require('../../models/Fee');
const Lead = require('../../models/Lead');
const Progress = require('../../models/Progress');
const LeaveRequest = require('../../models/LeaveRequest');
const Assignment = require('../../models/Assignment');
const { todayIST } = require('../../utils/dateHelper');
const { calculateStudentsAttendance } = require('../../utils/attendanceHelper');
const safeRedirect = require('../../utils/safeRedirect');
const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');

function getRoleRedirect(role, queryParams = '') {
  const map = {
    student: '/admin/students',
    teacher: '/admin/teachers',
    counsellor: '/admin/counsellors'
  };
  const base = map[role] || '/admin/dashboard';
  return queryParams ? `${base}${queryParams}` : base;
}

/**
 * GET /admin/dashboard
 * Renders the main Administrator Dashboard with aggregated student, teacher, and lead statistics.
 */
exports.getDashboard = async (req, res) => {
  try {
    const todayStr = todayIST();

    // 1. Today's Fee Collections
    const fees = await Fee.find().select('payments');
    const isToday = (d) => {
      if (!d) return false;
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(new Date(d)) === todayStr;
    };
    let todayCollections = 0;
    fees.forEach(f => {
      if (f.payments) {
        f.payments.forEach(p => {
          if (isToday(p.paidAt)) {
            todayCollections += p.amount;
          }
        });
      }
    });

    // 2. Today's Scheduled Classes
    const todaySchedules = await Schedule.find({ date: todayStr }).select('status');
    const todayScheduledCount = todaySchedules.length;
    const todayCompletedCount = todaySchedules.filter(s => s.status === 'completed').length;

    // 3. Leads Ready to Convert
    const readyLeadsCount = await Lead.countDocuments({ status: 'ready_to_convert' });

    // 4. At-Risk Students
    const students = await User.find({ role: 'student', isActive: true });
    const studentIds = students.map(u => u._id);
    const [attendanceRecords, todayRecords] = await Promise.all([
      Attendance.find({ student: { $in: studentIds } }),
      Attendance.find({ date: todayStr, student: { $in: studentIds } })
    ]);
    await calculateStudentsAttendance(students, attendanceRecords, todayRecords);
    const atRiskCount = students.filter(s => s.attendancePct < 75).length;

    // 5. Pending Leave Requests
    const pendingLeavesCount = await LeaveRequest.countDocuments({ status: 'pending' });

    // 6. Ungraded Submissions
    const assignmentsList = await Assignment.find().select('submissions');
    let ungradedSubmissionsCount = 0;
    assignmentsList.forEach(a => {
      if (a.submissions) {
        a.submissions.forEach(sub => {
          if (sub.marks === null || sub.marks === undefined) {
            ungradedSubmissionsCount++;
          }
        });
      }
    });

    // Reset requests and messages
    const [resetRequests, messages] = await Promise.all([
      User.find({ resetRequested: true }).select('name email role phone'),
      Message.find({ recipient: req.user._id })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    const recentStudents = await User.find({ role: 'student' })
      .sort({ createdAt: -1 }).limit(5).select('name course batch enrollmentDate');

    const hotLeads = await Lead.find({ status: { $in: ['interested', 'contacted'] } })
      .sort({ followUpDate: 1 }).limit(5).populate('assignedTo', 'name');

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.user,
      stats: {
        todayCollections,
        todayScheduledCount,
        todayCompletedCount,
        readyLeadsCount,
        atRiskCount,
        pendingLeavesCount,
        ungradedSubmissionsCount
      },
      recentStudents,
      hotLeads,
      resetRequests,
      messages,
    });
  } catch (err) {
    logger.error('Admin Dashboard Fetch Error', { err: err.message, stack: err.stack });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/users
 * Displays the general users directory with support for role and name searches.
 */
/**
 * GET /admin/profile-requests
 * Admin only. Renders a queue list of pending student profile change requests.
 */
exports.getProfileRequests = async (req, res) => {
  try {
    const students = await User.find({
      role: 'student',
      'pendingProfileUpdate.requestedAt': { $ne: null }
    }).sort({ 'pendingProfileUpdate.requestedAt': -1 });

    res.render('admin/profile-requests', {
      title: 'Profile Update Requests',
      user: req.user,
      students,
      page: 'profile-requests'
    });
  } catch (err) {
    logger.error('Get Profile Requests Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.render('admin/users', { title: 'Manage Users', user: req.user, users, filter: req.query });
  } catch (err) {
    logger.error('Get Users Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/students
 * Displays student records with attendance computation and filterable attendance tiers.
 */
exports.getStudents = async (req, res) => {
  try {
    const { search, attendance } = req.query;
    const filter = { role: 'student' };
    
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { rollNumber: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { batch: { $regex: escaped, $options: 'i' } }
      ];
    }
  
    let users = await User.find(filter).sort({ createdAt: -1 });
  
    if (users.length > 0) {
      const studentIds = users.map(u => u._id);
      const [attendanceRecords, todayRecords] = await Promise.all([
        Attendance.find({ student: { $in: studentIds } }),
        Attendance.find({ date: todayIST(), student: { $in: studentIds } })
      ]);
  
      await calculateStudentsAttendance(users, attendanceRecords, todayRecords);
  
      if (attendance) {
        users = users.filter(u => {
          if (attendance === 'low') return u.attendancePct < 75;
          if (attendance === 'medium') return u.attendancePct >= 75 && u.attendancePct <= 85;
          if (attendance === 'high') return u.attendancePct > 85;
          if (attendance === 'not_marked_today') return !u.isMarkedToday;
          return true;
        });
      }
    }
  
    res.render('admin/users', { 
      title: 'Manage Students', 
      user: req.user, 
      users, 
      roleActive: 'student',
      page: 'students',
      filter: req.query 
    });
  } catch (err) {
    logger.error('getStudents Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/teachers
 * Displays the list of registered teachers.
 */
exports.getTeachers = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { role: 'teacher' };
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.render('admin/users', { 
      title: 'Manage Teachers', 
      user: req.user, 
      users, 
      roleActive: 'teacher',
      page: 'teachers',
      filter: req.query 
    });
  } catch (err) {
    logger.error('getTeachers Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/counsellors
 * Displays the list of registered counsellors.
 */
exports.getCounsellors = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { role: 'counsellor' };
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.render('admin/users', { 
      title: 'Manage Counsellors', 
      user: req.user, 
      users, 
      roleActive: 'counsellor',
      page: 'counsellors',
      filter: req.query 
    });
  } catch (err) {
    logger.error('getCounsellors Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/users/create
 * Renders the new user creation form.
 */
exports.getCreateUser = async (req, res) => {
  try {
    const Batch = require('../../models/Batch');
    const batches = await Batch.find({ isActive: true }).select('name').sort({ name: 1 });
    res.render('admin/user-form', { 
      title: 'Add User', 
      user: req.user, 
      target: null, 
      defaultRole: req.query.role || '',
      batches
    });
  } catch (err) {
    logger.error('getCreateUser Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /admin/users/create
 * Creates a new user record.
 */
exports.postCreateUser = async (req, res) => {
  const data = { ...req.body };
  logger.info('Create User request received', { name: data.name, role: data.role, email: data.email });
  const Batch = require('../../models/Batch');
  try {
    if (data.role === 'student') {
      data.batch = (data.batch && data.batch.trim()) ? data.batch.trim() : 'General Batch';
    }
    if (req.file) data.profilePic = `/files/${req.file.filename}`;
    
    if (data.email) {
      const email = data.email.trim().toLowerCase();
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        const batches = await Batch.find({ isActive: true }).select('name').sort({ name: 1 });
        return res.render('admin/user-form', {
          title: 'Add User',
          user: req.user,
          target: null,
          defaultRole: req.body.role || '',
          batches,
          error: 'This email address is already registered.'
        });
      }
    }

    data.statusHistory = [{
      status: data.status || 'active',
      changedBy: req.user._id,
      reason: 'Initial enrollment creation'
    }];
    const newUser = await User.create(data);

    logger.info('User created successfully', { userId: newUser._id, rollNumber: newUser.rollNumber });

    if (newUser.role === 'student' && data.fees_total) {
      const totalAmount = Number(data.fees_total);
      const paidAmount = Number(data.fees_paid) || 0;
      const feeLedger = new Fee({
        student: newUser._id,
        course: newUser.course || 'Digital Marketing',
        totalAmount: totalAmount,
        paidAmount: paidAmount,
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
      logger.info('Auto-created Fee ledger for new student', { studentId: newUser._id });
    }
    res.redirect(getRoleRedirect(newUser.role, '?created=1'));
  } catch (err) {
    logger.error('Create User Error', { err: err.message });
    const batches = await Batch.find({ isActive: true }).select('name').sort({ name: 1 });
    res.render('admin/user-form', { 
      title: 'Add User', 
      user: req.user, 
      target: null, 
      defaultRole: req.body.role || '', 
      batches,
      error: err.message 
    });
  }
};

/**
 * GET /admin/users/:id/edit
 * Renders the user modification form.
 */
exports.getEditUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.redirect('/admin/dashboard');
    const Batch = require('../../models/Batch');
    const batches = await Batch.find({ isActive: true }).select('name').sort({ name: 1 });
    res.render('admin/user-form', { 
      title: 'Edit User', 
      user: req.user, 
      target, 
      defaultRole: target.role,
      batches
    });
  } catch (err) {
    logger.error('getEditUser Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /admin/users/:id/edit
 * Updates an existing user record.
 */
exports.postEditUser = async (req, res) => {
  const data = { ...req.body };
  logger.info('Edit User request received', { userId: req.params.id, name: data.name, role: data.role });
  try {
    if (req.file) data.profilePic = `/files/${req.file.filename}`;
    delete data.password;

    const u = await User.findById(req.params.id);
    if (!u) return res.redirect('/admin/dashboard');

    if (data.email) {
      const email = data.email.trim().toLowerCase();
      const existingUser = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (existingUser) {
        return res.render('admin/user-form', {
          title: 'Edit User',
          user: req.user,
          target: u,
          defaultRole: u.role,
          error: 'This email address is already registered.'
        });
      }
    }

    const oldStatus = u.status;

    Object.keys(data).forEach(key => {
      u[key] = data[key];
    });

    if (u.status !== oldStatus) {
      u.statusHistory.push({
        status: u.status,
        changedBy: req.user._id,
        reason: 'Profile status updated by Administrator'
      });
    }

    await u.save();
    logger.info('User updated successfully', { userId: req.params.id, status: u.status });
    res.redirect(getRoleRedirect(u.role, '?updated=1'));
  } catch (err) {
    logger.error('Edit User Error', { err: err.message });
    res.redirect(getRoleRedirect(data.role || 'student', `/${req.params.id}/edit?error=1`));
  }
};

/**
 * POST /admin/users/:id/toggle
 * Toggle the isActive state of a user record.
 */
exports.toggleUserStatus = async (req, res) => {
  logger.info('Toggle user status request received', { userId: req.params.id });
  try {
    const u = await User.findById(req.params.id);
    if (u) { 
      u.isActive = !u.isActive; 
      await u.save(); 
      logger.info('User status toggled successfully', { userId: req.params.id, isActive: u.isActive });
      res.redirect(getRoleRedirect(u.role));
    } else {
      res.redirect('/admin/dashboard');
    }
  } catch (err) {
    logger.error('toggleUserStatus Error', { err: err.message });
    res.redirect('/admin/dashboard?error=1');
  }
};

/**
 * POST /admin/users/:id/reset-password
 * Triggers a manual password overwrite for a target user profile.
 */
exports.resetPassword = async (req, res) => {
  logger.info('Admin password reset request received', { userId: req.params.id });
  const { password } = req.body;
  const targetRedirect = safeRedirect(req.body.redirect, '/admin/dashboard');

  if (!password || password.trim().length < 8) {
    const errorRedirect = targetRedirect.includes('?') ? `${targetRedirect}&error=Password+must+be+at+least+8+characters` : `${targetRedirect}?error=Password+must+be+at+least+8+characters`;
    return res.redirect(errorRedirect);
  }

  try {
    const u = await User.findById(req.params.id);
    if (!u) {
      const errorRedirect = targetRedirect.includes('?') ? `${targetRedirect}&error=User+not+found` : `${targetRedirect}?error=User+not+found`;
      return res.redirect(errorRedirect);
    }
    u.password = password.trim();
    u.resetRequested = false;
    await u.save();
    logger.info('User password reset successfully', { userId: req.params.id });
    
    const successRedirect = targetRedirect.includes('?') ? `${targetRedirect}&pwd_reset=1` : `${targetRedirect}?pwd_reset=1`;
    res.redirect(successRedirect);
  } catch (err) {
    logger.error('Admin Reset Password Error', { err: err.message });
    const errorRedirect = targetRedirect.includes('?') ? `${targetRedirect}&error=1` : `${targetRedirect}?error=1`;
    res.redirect(errorRedirect);
  }
};

/**
 * POST /admin/users/:id/dismiss-reset
 * Dismisses a pending password reset request on a user record.
 */
exports.dismissResetRequest = async (req, res) => {
  logger.info('Dismiss password reset request received', { userId: req.params.id });
  const targetRedirect = safeRedirect(req.body.redirect, '/admin/dashboard');
  try {
    const u = await User.findByIdAndUpdate(req.params.id, { resetRequested: false });
    if (!u) {
      const errorRedirect = targetRedirect.includes('?') ? `${targetRedirect}&error=User+not+found` : `${targetRedirect}?error=User+not+found`;
      return res.redirect(errorRedirect);
    }
    logger.info('Dismissed password reset request', { userId: req.params.id });
    const successRedirect = targetRedirect.includes('?') ? `${targetRedirect}&updated=1` : `${targetRedirect}?updated=1`;
    res.redirect(successRedirect);
  } catch (err) {
    logger.error('Dismiss Reset Request Error', { err: err.message });
    const errorRedirect = targetRedirect.includes('?') ? `${targetRedirect}&error=1` : `${targetRedirect}?error=1`;
    res.redirect(errorRedirect);
  }
};

/**
 * GET /admin/students/:id
 * Fetches and displays the complete detailed profile of a student (including attendance logs, grades, and invoicing).
 */
exports.getStudentProfile = async (req, res) => {
  try {
    const student = await User.findById(req.params.id)
      .populate('teacher', 'name email rollNumber phone')
      .populate('counsellor', 'name email rollNumber phone');
      
    if (!student || student.role !== 'student') {
      return res.redirect('/admin/users');
    }

    const [fee, attendance, progress, lead, messages] = await Promise.all([
      Fee.findOne({ student: student._id }).populate('payments.receivedBy', 'name'),
      Attendance.find({ student: student._id }).populate('teacher', 'name').sort({ date: -1 }),
      Progress.findOne({ student: student._id }).populate('teacher', 'name'),
      Lead.findOne({ convertedStudent: student._id }).populate('assignedTo', 'name'),
      Message.find({ recipient: student._id }).populate('sender', 'name role').sort({ createdAt: -1 }),
    ]);

    res.render('admin/student-profile', {
      title: `${student.name} — Profile`,
      user: req.user,
      student,
      fee,
      attendance,
      progress,
      lead,
      messages,
    });
  } catch (err) {
    logger.error('Student Profile Fetch Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /admin/students/:id/verify-id
 * Marks a student's ID proof document as verified.
 */
exports.postVerifyStudentId = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) return res.redirect('/admin/dashboard');

    student.idVerified = true;
    await student.save();

    logger.info('Student ID verified successfully', { studentId: student._id });
    res.redirect(`/admin/students/${student._id}?verified=1`);
  } catch (err) {
    logger.error('Verify Student ID Error', { err: err.message });
    res.redirect(`/admin/students/${req.params.id}?error=1`);
  }
};

/**
 * POST /admin/students/:id/remark
 * Appends a staff/admin remark to a student profile.
 */
exports.postAddStudentRemark = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) return res.redirect('/admin/dashboard');

    student.remarks.push({
      postedBy: req.user._id,
      role: req.user.role,
      note: req.body.note
    });
    await student.save();

    logger.info('Student remark added successfully', { studentId: student._id });
    res.redirect(`/admin/students/${student._id}?updated=1`);
  } catch (err) {
    logger.error('Add Student Remark Error', { err: err.message });
    res.redirect(`/admin/students/${req.params.id}?error=1`);
  }
};

/**
 * POST /admin/students/:id/status
 * Updates student status and appends state history.
 */
exports.postUpdateStudentStatus = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) return res.redirect('/admin/dashboard');

    const oldStatus = student.status;
    student.status = req.body.status;
    student.isActive = (req.body.status === 'active');

    student.statusHistory.push({
      status: req.body.status,
      changedBy: req.user._id,
      reason: req.body.reason || 'Manual status change'
    });

    await student.save();
    logger.info('Student status updated with history', { studentId: student._id, oldStatus, newStatus: student.status });
    res.redirect(`/admin/students/${student._id}?updated=1`);
  } catch (err) {
    logger.error('Update Student Status Error', { err: err.message });
    res.redirect(`/admin/students/${req.params.id}?error=1`);
  }
};

/**
 * POST /admin/students/:id/approve-profile
 * Approves a student's pending profile change requests.
 */
exports.postApproveProfileUpdate = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.redirect('/admin/users');
    }

    const pending = student.pendingProfileUpdate;
    if (pending && pending.requestedAt) {
      if (pending.name !== null) student.name = pending.name;
      if (pending.phone !== null) student.phone = pending.phone;
      if (pending.profilePic !== null) student.profilePic = pending.profilePic;
      if (pending.fatherName !== null) student.fatherName = pending.fatherName;
      if (pending.motherName !== null) student.motherName = pending.motherName;
      if (pending.address !== null) student.address = pending.address;
      if (pending.city !== null) student.city = pending.city;
      if (pending.dob !== null) student.dob = pending.dob;

      student.pendingProfileUpdate = {
        name: null,
        phone: null,
        profilePic: null,
        fatherName: null,
        motherName: null,
        address: null,
        city: null,
        dob: null,
        requestedAt: null
      };

      await student.save();
      logger.info('Student profile update request approved', { studentId: student._id });
    }

    res.redirect(req.body.redirect || `/admin/students/${student._id}?profile_approved=1`);
  } catch (err) {
    logger.error('Approve Profile Update Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /admin/students/:id/reject-profile
 * Rejects a student's pending profile change requests.
 */
exports.postRejectProfileUpdate = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.redirect('/admin/users');
    }

    student.pendingProfileUpdate = {
      name: null,
      phone: null,
      profilePic: null,
      fatherName: null,
      motherName: null,
      address: null,
      city: null,
      dob: null,
      requestedAt: null
    };

    await student.save();
    logger.info('Student profile update request rejected', { studentId: student._id });

    res.redirect(req.body.redirect || `/admin/students/${student._id}?profile_rejected=1`);
  } catch (err) {
    logger.error('Reject Profile Update Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/teachers/:id
 * Fetches and displays teacher record timeline history.
 */
exports.getTeacherProfile = async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher || teacher.role !== 'teacher') {
      return res.redirect('/admin/users');
    }

    const [curricula, updates, schedules, messages] = await Promise.all([
      Curriculum.find({ teacher: teacher._id }),
      DailyUpdate.find({ teacher: teacher._id }).sort({ date: -1 }),
      Schedule.find({ teacher: teacher._id }).sort({ date: 1, startTime: 1 }),
      Message.find({ recipient: teacher._id }).populate('sender', 'name role').sort({ createdAt: -1 }),
    ]);

    res.render('admin/teacher-profile', {
      title: `${teacher.name} — Profile`,
      user: req.user,
      teacher,
      curricula,
      updates,
      schedules,
      messages,
    });
  } catch (err) {
    logger.error('Teacher Profile Fetch Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /admin/counsellors/:id
 * Fetches and displays counsellor dashboard metrics.
 */
exports.getCounsellorProfile = async (req, res) => {
  try {
    const counsellor = await User.findById(req.params.id);
    if (!counsellor || counsellor.role !== 'counsellor') {
      return res.redirect('/admin/users');
    }

    const [leads, messages, counsellors] = await Promise.all([
      Lead.find({ assignedTo: counsellor._id }).sort({ createdAt: -1 }),
      Message.find({ recipient: counsellor._id }).populate('sender', 'name role').sort({ createdAt: -1 }),
      User.find({ role: 'counsellor', isActive: true }).select('name')
    ]);
    
    const totalLeads = leads.length;
    const convertedLeads = leads.filter(l => l.status === 'converted').length;
    const activeLeads = leads.filter(l => !['converted', 'lost'].includes(l.status)).length;
    const lostLeads = leads.filter(l => l.status === 'lost').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    res.render('admin/counsellor-profile', {
      title: `${counsellor.name} — Profile`,
      user: req.user,
      counsellor,
      leads,
      messages,
      counsellors,
      stats: { totalLeads, convertedLeads, activeLeads, lostLeads, conversionRate },
    });
  } catch (err) {
    logger.error('Counsellor Profile Fetch Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /admin/messages/send
 * Sends a message from the Administrator to any recipient.
 */
exports.postSendMessage = async (req, res) => {
  try {
    const { recipientId, content, redirect } = req.body;
    const { validateAndSanitizeMessage } = require('../../utils/messageValidator');
    const { cleanContent } = await validateAndSanitizeMessage(req.user, recipientId, content);

    await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content: cleanContent,
    });
    res.redirect(`${redirect || '/admin/users'}?posted=1`);
  } catch (err) {
    logger.error('Send Message Error', { err: err.message });
    res.redirect(`${req.body.redirect || '/admin/users'}?error=${encodeURIComponent(err.message)}`);
  }
};

/**
 * POST /admin/messages/:id/read
 * Marks a specific notification message as read.
 */
exports.markMessageRead = async (req, res) => {
  try {
    const messageId = req.params.id;
    const message = await Message.findOneAndUpdate(
      { _id: messageId, recipient: req.user._id },
      { $set: { read: true } },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    res.json({ success: true, message: 'Message marked as read' });
  } catch (err) {
    logger.error('Mark Message Read Error', { err: err.message });
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * POST /admin/messages/read-all (AJAX helper)
 * Marks all notification messages received by the user as read.
 */
exports.markAllMessagesRead = async (req, res) => {
  try {
    await Message.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    logger.error('Mark All Messages Read Error', { err: err.message });
    res.status(500).json({ success: false });
  }
};

/**
 * GET /admin/students/:id/certificate
 * Renders the printable certificate for students with 'complete' status.
 */
exports.getStudentCertificate = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student' || student.status !== 'complete') {
      logger.warn('Certificate request for incomplete or invalid student', { id: req.params.id });
      return res.redirect(`/admin/students/${req.params.id || ''}?error=Certificate+not+generated+yet`);
    }

    const completeEntry = student.statusHistory.find(h => h.status === 'complete');
    const completionDate = completeEntry ? completeEntry.date : student.updatedAt || new Date();

    res.render('admin/certificate', {
      title: `${student.name} — Graduation Certificate`,
      layout: false,
      student,
      completionDate
    });
  } catch (err) {
    logger.error('Get Student Certificate Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};
