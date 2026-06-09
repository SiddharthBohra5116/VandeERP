const User = require('../../models/User');
const Attendance = require('../../models/Attendance');
const Assignment = require('../../models/Assignment');
const Progress = require('../../models/Progress');
const { calculateStudentsAttendance } = require('../../utils/attendanceHelper');
const { todayIST } = require('../../utils/dateHelper');

// ─── PROGRESS ─────────────────────────────────────────────────────────────────

/**
 * GET /teacher/progress
 * Shows student progress records for a given batch + subject.
 * Both filters must be selected before data is loaded.
 */
exports.getProgress = async (req, res) => {
  const { batch, subject } = req.query;
  console.log('📈 Progress page load:', { teacherId: req.user._id, batch, subject });
  try {
    let students = [];
    let progressRecords = [];

    if (batch && subject) {
      students = await User.find({ role: 'student', batch, isActive: true }).sort({ name: 1 });
      const studentIds = students.map(s => s._id);
      progressRecords = await Progress.find({ subject, student: { $in: studentIds } }).populate('student', 'name').populate('teacher', 'name');
    }

    const batches = await User.distinct('batch', { role: 'student', isActive: true });
    res.render('teacher/progress', {
      title: 'Student Progress', user: req.user, students, progressRecords, batches, filter: req.query,
    });
  } catch (err) {
    console.error('❌ Progress Page Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /teacher/progress/test
 * Adds a test result to a student's progress record (upserts if not found).
 * The Progress model's pre-save hook recalculates overallScore automatically.
 */
exports.postAddTestResult = async (req, res) => {
  const { studentId, subject, testName, score, totalMarks, date, remarks } = req.body;
  console.log('🏆 Add Test Result request:', { teacherId: req.user._id, studentId, subject, testName });
  try {
    let record = await Progress.findOne({ student: studentId, subject, teacher: req.user._id });
    if (!record) {
      record = new Progress({ student: studentId, subject, teacher: req.user._id });
    }
    record.testResults.push({ testName, score: Number(score), totalMarks: Number(totalMarks), date, remarks });
    await record.save();
    console.log('✅ Test result recorded:', { studentId, subject, testName });
    res.redirect(`/teacher/progress?batch=${req.body.batch}&subject=${subject}&saved=1`);
  } catch (err) {
    console.error('❌ Add Test Result Error:', { studentId, subject, error: err.message });
    res.redirect('/teacher/progress?error=1');
  }
};

/**
 * POST /teacher/progress/:studentId/remark
 * Updates the qualitative teacher remark on a student's subject progress record.
 */
exports.postUpdateRemark = async (req, res) => {
  console.log('💬 Update Progress Remark request:', { studentId: req.params.studentId, subject: req.body.subject });
  try {
    await Progress.findOneAndUpdate(
      { student: req.params.studentId, subject: req.body.subject, teacher: req.user._id },
      { teacherRemark: req.body.remark }
    );
    res.redirect(`/teacher/progress?batch=${req.body.batch}&subject=${req.body.subject}&saved=1`);
  } catch (err) {
    console.error('❌ Update Progress Remark Error:', { studentId: req.params.studentId, error: err.message });
    res.redirect('/teacher/progress?error=1');
  }
};

// ─── MY STUDENTS ──────────────────────────────────────────────────────────────

/**
 * GET /teacher/students
 * Lists all active students (optionally filtered by batch, name search, and
 * attendance tier). Computes attendance %, ungraded submission counts, and
 * overall progress score for each student in a single bulk-fetch pass.
 */
exports.getMyStudents = async (req, res) => {
  const { batch, search, attendance } = req.query;
  console.log('👨‍🎓 My Students list load:', { teacherId: req.user._id, batch, search, attendance });
  try {
    const Schedule = require('../../models/Schedule');
    const assignedBatches = await Schedule.distinct('batch', { teacher: req.user._id });
    const filter = { role: 'student', status: { $in: ['active', 'complete'] }, batch: { $in: assignedBatches } };
    const { escapeRegex } = require('../../utils/sanitize');
    if (batch) filter.batch = batch;
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };

    const [students, batches] = await Promise.all([
      User.find(filter).sort({ name: 1 }),
      User.distinct('batch', { role: 'student', isActive: true }),
    ]);

    if (students.length > 0) {
      const studentIds = students.map(s => s._id);
      const todayStr = todayIST();

      const [attendanceRecords, todayRecords, progressRecords, assignments] = await Promise.all([
        Attendance.find({ student: { $in: studentIds } }),
        Attendance.find({ date: todayStr, student: { $in: studentIds } }),
        Progress.find({ student: { $in: studentIds } }),
        Assignment.find({ teacher: req.user._id }),
      ]);

      await calculateStudentsAttendance(students, attendanceRecords, todayRecords);

      // Ungraded submission counts per student
      const ungradedCounts = {};
      studentIds.forEach(id => { ungradedCounts[id.toString()] = 0; });
      assignments.forEach(a => {
        a.submissions.forEach(sub => {
          if (sub.student && ungradedCounts[sub.student.toString()] !== undefined && sub.status !== 'graded') {
            ungradedCounts[sub.student.toString()]++;
          }
        });
      });

      // Average progress scores per student
      const studentProgress = {};
      progressRecords.forEach(p => {
        if (!studentProgress[p.student.toString()]) studentProgress[p.student.toString()] = [];
        studentProgress[p.student.toString()].push(p.overallScore || 0);
      });

      students.forEach(s => {
        const scores = studentProgress[s._id.toString()] || [];
        s.overallProgress = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        s.ungradedCount = ungradedCounts[s._id.toString()] || 0;
      });

      let filtered = students;
      if (attendance) {
        filtered = students.filter(s => {
          if (attendance === 'low')             return s.attendancePct < 75;
          if (attendance === 'medium')          return s.attendancePct >= 75 && s.attendancePct <= 85;
          if (attendance === 'high')            return s.attendancePct > 85;
          if (attendance === 'not_marked_today') return !s.isMarkedToday;
          return true;
        });
      }

      return res.render('teacher/students', {
        title: 'My Students', user: req.user, students: filtered, batches, filter: req.query,
      });
    }

    res.render('teacher/students', { title: 'My Students', user: req.user, students, batches, filter: req.query });
  } catch (err) {
    console.error('❌ My Students List Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};