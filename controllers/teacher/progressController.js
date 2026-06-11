const User = require('../../models/User');
const Student = require('../../models/Student');
const Batch = require('../../models/Batch');
const Course = require('../../models/Course');
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
      const courseDoc = await Course.findOne({ name: subject });
      const courseId = courseDoc ? courseDoc._id : null;
      const batchDoc = await Batch.findOne({ name: batch });
      const batchId = batchDoc ? batchDoc._id : null;

      const studentDocs = await Student.find({ batch });
      const studentUserIds = studentDocs.map(s => s.userId);
      students = await User.find({ _id: { $in: studentUserIds }, status: 'active' }).sort({ name: 1 });
      
      const studentProfileIds = studentDocs.map(s => s._id);
      
      if (courseId) {
        progressRecords = await Progress.find({ course: courseId, student: { $in: studentProfileIds } })
          .populate({
            path: 'student',
            populate: { path: 'userId', select: 'name' }
          })
          .populate('teacher', 'name');

        // Map progressRecords so student.name exists for views expecting it
        progressRecords = progressRecords.map(p => {
          const pObj = p.toObject();
          if (pObj.student && pObj.student.userId) {
            pObj.student.name = pObj.student.userId.name;
          }
          return pObj;
        });
      }
    }

    const batches = await Batch.distinct('name', { isActive: true });
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
    const courseDoc = await Course.findOne({ name: subject });
    const courseId = courseDoc ? courseDoc._id : null;
    const studentDoc = await Student.findById(studentId);
    const batchDoc = await Batch.findOne({ name: studentDoc ? studentDoc.batch : '' });

    let record = await Progress.findOne({ student: studentId, course: courseId });
    if (!record) {
      record = new Progress({
        student: studentId,
        course: courseId,
        batch: batchDoc ? batchDoc._id : null,
        teacher: req.user._id
      });
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
    const courseDoc = await Course.findOne({ name: req.body.subject });
    const courseId = courseDoc ? courseDoc._id : null;
    await Progress.findOneAndUpdate(
      { student: req.params.studentId, course: courseId },
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
    
    const Batch = require('../../models/Batch');
    const batchDocs = await Batch.find({ _id: { $in: assignedBatches } });
    const assignedBatchNames = batchDocs.map(b => b.name);

    const studentFilter = { batch: { $in: assignedBatchNames } };
    if (batch) studentFilter.batch = batch;

    const studentsWithProfile = await Student.find(studentFilter).populate('userId');
    let students = studentsWithProfile.map(sp => {
      const u = sp.userId ? sp.userId.toObject() : {};
      u.batch = sp.batch;
      u.studentId = sp._id; // Student profile ID
      u.idProof = sp.documents ? sp.documents.idProof : null;
      u.idVerified = sp.idVerified;
      u.status = sp.statusHistory && sp.statusHistory.length > 0 ? sp.statusHistory[sp.statusHistory.length - 1].status : 'active';
      return u;
    }).filter(u => u._id && (u.status === 'active' || u.status === 'complete'));

    if (search) {
      const searchLower = search.toLowerCase();
      students = students.filter(s => s.name && s.name.toLowerCase().includes(searchLower));
    }

    const batches = assignedBatchNames;

    if (students.length > 0) {
      const studentUserIds = students.map(s => s._id);
      const studentProfileIds = students.map(s => s.studentId);
      const todayStr = todayIST();

      const [attendanceRecords, todayRecords, progressRecords, assignments] = await Promise.all([
        Attendance.find({ student: { $in: studentProfileIds } }),
        Attendance.find({ date: todayStr, student: { $in: studentProfileIds } }),
        Progress.find({ student: { $in: studentProfileIds } }),
        Assignment.find({ teacher: req.user._id }),
      ]);

      await calculateStudentsAttendance(students, attendanceRecords, todayRecords);

      // Ungraded submission counts per student
      const ungradedCounts = {};
      studentUserIds.forEach(id => { ungradedCounts[id.toString()] = 0; });
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
        const scores = studentProgress[s.studentId.toString()] || [];
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