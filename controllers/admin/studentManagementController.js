const User = require('../../models/User');
const Student = require('../../models/Student');
const Fee = require('../../models/Fee');
const Attendance = require('../../models/Attendance');
const Progress = require('../../models/Progress');
const Lead = require('../../models/Lead');
const Message = require('../../models/Message');

const { todayIST } = require('../../utils/dateHelper');
const { calculateStudentsAttendance } = require('../../utils/attendanceHelper');
const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');


// GET /admin/students
exports.getStudents = async (req, res) => {
  try {
    const { search, attendance } = req.query;

    const userFilter = {
      role: 'student'
    };

    if (search) {
      const escaped = escapeRegex(search);

      userFilter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ];
    }

    const users = await User.find(userFilter).sort({ createdAt: -1 });

    const userIds = users.map(user => user._id);

    let studentProfiles = await Student.find({
      userId: { $in: userIds }
    })
      .populate('userId', 'name email phone status profilePic')
      .populate('course', 'name code')
      .populate('batch', 'name')
      .sort({ createdAt: -1 });

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

        plain.name = student.userId?.name || '';
        plain.status = student.userId?.status || '';

        return plain;
      });

      await calculateStudentsAttendance(
        studentsForAttendance,
        attendanceRecords,
        todayRecords
      );

      const attendanceMap = new Map(
        studentsForAttendance.map(student => [
          String(student._id),
          {
            attendancePct: student.attendancePct,
            isMarkedToday: student.isMarkedToday
          }
        ])
      );

      studentProfiles = studentProfiles.map(student => {
        const plain = student.toObject();
        const stats = attendanceMap.get(String(student._id)) || {};

        plain.attendancePct = stats.attendancePct || 0;
        plain.isMarkedToday = stats.isMarkedToday || false;

        return plain;
      });

      if (attendance) {
        studentProfiles = studentProfiles.filter(student => {
          if (attendance === 'low') return student.attendancePct < 75;
          if (attendance === 'medium') return student.attendancePct >= 75 && student.attendancePct <= 85;
          if (attendance === 'high') return student.attendancePct > 85;
          if (attendance === 'not_marked_today') return !student.isMarkedToday;
          return true;
        });
      }
    }

    res.render('admin/users', {
      title: 'Manage Students',
      user: req.user,
      users: studentProfiles,
      roleActive: 'student',
      page: 'students',
      filter: req.query
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
      .populate('userId', 'name email phone status profilePic address city dob socialHandle createdAt updatedAt')
      .populate('teacher', 'name email phone')
      .populate('counsellor', 'name email phone')
      .populate('course', 'name code durationMonths fees')
      .populate('batch', 'name');

    if (!student || !student.userId) {
      return res.redirect('/admin/students');
    }

    const [fee, attendance, progress, lead, messages] = await Promise.all([
      Fee.findOne({ student: student._id })
        .populate('payments.receivedBy', 'name'),

      Attendance.find({ student: student._id })
        .populate('teacher', 'name')
        .sort({ date: -1 }),

      Progress.findOne({ student: student._id })
        .populate('teacher', 'name')
        .populate('course', 'name code')
        .populate('batch', 'name'),

      Lead.findOne({ convertedStudent: student._id })
        .populate('assignedTo', 'name'),

      Message.find({ recipient: student.userId._id })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 })
    ]);

    res.render('admin/student-profile', {
      title: `${student.userId.name} — Profile`,
      user: req.user,
      student,
      fee,
      attendance,
      progress,
      lead,
      messages
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


// POST /admin/students/:id/verify-id
exports.postVerifyStudentId = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.redirect('/admin/students');
    }

    student.idVerified = true;
    await student.save();

    res.redirect(`/admin/students/${student._id}?verified=1`);

  } catch (err) {
    logger.error('Verify Student ID Error', { err: err.message });
    res.redirect(`/admin/students/${req.params.id}?error=1`);
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
    const student = await Student.findById(req.params.id).populate('userId');

    if (!student || !student.userId) {
      return res.redirect('/admin/students');
    }

    student.userId.status = req.body.status;

    await student.userId.save();

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