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
  const { batch, course } = req.query;
  console.log('📈 Progress page load:', { teacherId: req.user._id, batch, course });
  try {
    let students = [];
    let progressRecords = [];
    const mongoose = require('mongoose');

    if (batch && course) {
      if (mongoose.Types.ObjectId.isValid(batch) && mongoose.Types.ObjectId.isValid(course)) {
        const studentDocs = await Student.find({ batch });
        const studentUserIds = studentDocs.map(s => s.user);
        const activeUsers = await User.find({ _id: { $in: studentUserIds }, status: 'active' }).sort({ name: 1 });
        students = activeUsers.map(u => {
          const uObj = u.toObject();
          const profile = studentDocs.find(s => s.user.toString() === u._id.toString());
          uObj.studentProfileId = profile ? profile._id.toString() : null;
          return uObj;
        });
        
        const studentProfileIds = studentDocs.map(s => s._id);
        
        progressRecords = await Progress.find({ course, student: { $in: studentProfileIds } })
          .populate({
            path: 'student',
            populate: { path: 'user', select: 'name' }
          })
          .populate('teacher', 'name');

        // Map progressRecords so student.name exists for views expecting it
        progressRecords = progressRecords.map(p => {
          const pObj = p.toObject();
          if (pObj.student && pObj.student.user) {
            pObj.student.name = pObj.student.user.name;
          }
          return pObj;
        });
      }
    }

    const Schedule = require('../../models/Schedule');
    const Teacher = require('../../models/Teacher');
    const assignedBatches = await Schedule.distinct('batch', { teacher: req.user.teacherProfileId });
    const teacherProfile = await Teacher.findById(req.user.teacherProfileId);
    
    const [batches, courses, teacherSchedules] = await Promise.all([
      Batch.find({ _id: { $in: assignedBatches }, isActive: true }).select('name'),
      Course.find({ _id: { $in: teacherProfile ? teacherProfile.courses : [] } }).select('name'),
      Schedule.find({ teacher: req.user.teacherProfileId })
        .populate('batch', 'name')
        .populate('course', 'name')
    ]);

    // Extract unique tests for History and Bulk-edit reference
    const uniqueTestsMap = {};
    progressRecords.forEach(record => {
      if (record.testResults && Array.isArray(record.testResults)) {
        record.testResults.forEach(test => {
          const key = test.testName;
          if (!uniqueTestsMap[key]) {
            uniqueTestsMap[key] = {
              testName: test.testName,
              date: test.date,
              totalMarks: test.totalMarks,
              scoresCount: 0,
              totalScore: 0,
              studentScores: {} // studentProfileId -> score
            };
          }
          uniqueTestsMap[key].scoresCount++;
          uniqueTestsMap[key].totalScore += test.score;
          if (record.student) {
            uniqueTestsMap[key].studentScores[record.student._id.toString()] = test.score;
          }
        });
      }
    });

    const uniqueTests = Object.values(uniqueTestsMap).map(t => ({
      ...t,
      avgScore: t.scoresCount ? Math.round((t.totalScore / (t.scoresCount * t.totalMarks)) * 100) : 0
    }));

    res.render('teacher/progress', {
      title: 'Student Progress',
      user: req.user,
      students,
      progressRecords,
      uniqueTests,
      batches,
      courses,
      teacherSchedules,
      filter: { batch: batch || '', course: course || '' },
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
  const { studentId, course, testName, score, totalMarks, date, remarks } = req.body;
  console.log('🏆 Add Test Result request:', { teacherId: req.user._id, studentId, course, testName });
  const mongoose = require('mongoose');

  if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(course)) {
    return res.redirect('/teacher/progress?error=invalid_params');
  }

  try {
    const studentDoc = await Student.findById(studentId);
    if (!studentDoc) {
      return res.redirect('/teacher/progress?error=student_not_found');
    }

    let record = await Progress.findOne({ student: studentId, course });
    if (!record) {
      record = new Progress({
        student: studentId,
        course,
        batch: studentDoc.batch,
        teacher: req.user.teacherProfileId
      });
    }
    record.testResults.push({ testName, score: Number(score), totalMarks: Number(totalMarks), date, remarks });
    await record.save();
    console.log('✅ Test result recorded:', { studentId, course, testName });
    res.redirect(`/teacher/progress?batch=${studentDoc.batch}&course=${course}&saved=1`);
  } catch (err) {
    console.error('❌ Add Test Result Error:', { studentId, course, error: err.message });
    res.redirect('/teacher/progress?error=1');
  }
};

/**
 * POST /teacher/progress/:studentId/remark
 * Updates the qualitative teacher remark on a student's subject progress record.
 */
exports.postUpdateRemark = async (req, res) => {
  const { course, remark } = req.body;
  console.log('💬 Update Progress Remark request:', { studentId: req.params.studentId, course });
  const mongoose = require('mongoose');

  if (!mongoose.Types.ObjectId.isValid(req.params.studentId) || !mongoose.Types.ObjectId.isValid(course)) {
    return res.redirect('/teacher/progress?error=invalid_params');
  }

  try {
    const studentDoc = await Student.findById(req.params.studentId);
    if (!studentDoc) {
      return res.redirect('/teacher/progress?error=student_not_found');
    }

    await Progress.findOneAndUpdate(
      { student: req.params.studentId, course },
      { teacherRemark: remark }
    );
    res.redirect(`/teacher/progress?batch=${studentDoc.batch}&course=${course}&saved=1`);
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
    const assignedBatches = await Schedule.distinct('batch', { teacher: req.user.teacherProfileId });
    
    const Batch = require('../../models/Batch');
    const batchDocs = await Batch.find({ _id: { $in: assignedBatches } });
    const assignedBatchNames = batchDocs.map(b => b.name);

    let targetBatchIds = assignedBatches;
    if (batch) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(batch)) {
        targetBatchIds = [batch];
      } else {
        const selectedBatchDoc = batchDocs.find(b => b.name === batch);
        targetBatchIds = selectedBatchDoc ? [selectedBatchDoc._id] : [];
      }
    }

    const studentFilter = { batch: { $in: targetBatchIds } };

    const studentsWithProfile = await Student.find(studentFilter)
      .populate('user')
      .populate('batch', 'name')
      .populate('course', 'name');
    let students = studentsWithProfile.map(sp => {
      const u = sp.user ? sp.user.toObject() : {};
      u.batch = sp.batch && sp.batch.name ? sp.batch.name : sp.batch;
      u.batchId = sp.batch ? sp.batch._id : null;
      u.course = sp.course && sp.course.name ? sp.course.name : '';
      u.courseId = sp.course ? sp.course._id : null;
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
        Assignment.find({ teacher: req.user.teacherProfileId }),
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

/**
 * GET /teacher/students/:id/profile-summary
 * Fetches rich details for a single student profile (attendance rate, submissions, test grades).
 */
exports.getStudentProfileSummary = async (req, res) => {
  const { id } = req.params;
  try {
    const student = await Student.findById(id)
      .populate('user', 'name email phone status')
      .populate('batch', 'name')
      .populate('course', 'name');

    if (!student) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const [attendanceRecords, progressRecords, assignments] = await Promise.all([
      Attendance.find({ student: student._id }).populate('course', 'name').sort({ date: -1 }),
      Progress.find({ student: student._id }).populate('course', 'name'),
      Assignment.find({ batch: student.batch ? student.batch._id : null }).populate('course', 'name')
    ]);

    // Attendance stats
    const totalAttendance = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
    const attendancePct = totalAttendance ? Math.round((presentCount / totalAttendance) * 100) : 100;

    // Assignment Submissions
    const submissionsList = assignments.map(a => {
      const sub = a.submissions.find(s => s.student.toString() === student._id.toString());
      return {
        assignmentTitle: a.title,
        dueDate: a.dueDate,
        totalMarks: a.totalMarks,
        courseName: a.course ? a.course.name : '—',
        status: sub ? sub.status : 'pending',
        submittedAt: sub ? sub.submittedAt : null,
        marks: sub ? sub.marks : null,
        feedback: sub ? sub.feedback : '',
        fileName: sub ? sub.fileName : null,
        fileUrl: sub ? sub.fileUrl : null
      };
    });

    res.json({
      ok: true,
      student: {
        id: student._id,
        name: student.user ? student.user.name : 'Unknown',
        email: student.user ? student.user.email : '—',
        phone: student.user ? student.user.phone : '—',
        rollNumber: student.rollNumber || '—',
        batchName: student.batch ? student.batch.name : '—',
        courseName: student.course ? student.course.name : '—',
      },
      attendance: {
        pct: attendancePct,
        total: totalAttendance,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        history: attendanceRecords.slice(0, 10).map(r => ({
          date: r.date,
          status: r.status,
          course: r.course ? r.course.name : '—',
          note: r.note || ''
        }))
      },
      progress: progressRecords.map(p => ({
        courseName: p.course ? p.course.name : '—',
        overallScore: p.overallScore,
        teacherRemark: p.teacherRemark || '—',
        testResults: p.testResults.map(tr => ({
          testName: tr.testName,
          score: tr.score,
          totalMarks: tr.totalMarks,
          date: tr.date,
          remarks: tr.remarks || ''
        }))
      })),
      assignments: submissionsList
    });
  } catch (err) {
    console.error('❌ Student Profile JSON Fetch Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * POST /teacher/progress/bulk-test
 * Logs or edits a test result for multiple students in a batch + course in one request.
 * If a test with the same name already exists for a student, it overwrites their score and remarks.
 */
exports.postBulkAddTestResult = async (req, res) => {
  const { course, batch, testName, totalMarks, date, scores, remarks } = req.body;
  console.log('🏆 Bulk Add Test Result request:', { teacherId: req.user._id, course, batch, testName });
  const mongoose = require('mongoose');

  if (!mongoose.Types.ObjectId.isValid(batch) || !mongoose.Types.ObjectId.isValid(course)) {
    return res.redirect('/teacher/progress?error=invalid_params');
  }

  try {
    const studentProfiles = await Student.find({ batch });
    
    for (const student of studentProfiles) {
      const studentIdStr = student._id.toString();
      const scoreVal = scores ? scores[studentIdStr] : '';
      
      // Save/update score if a value is provided
      if (scoreVal !== undefined && scoreVal !== '') {
        const score = Number(scoreVal);
        const remark = remarks ? remarks[studentIdStr] : '';
        
        let record = await Progress.findOne({ student: student._id, course });
        if (!record) {
          record = new Progress({
            student: student._id,
            course,
            batch,
            teacher: req.user.teacherProfileId
          });
        }
        
        const existingTest = record.testResults.find(t => t.testName.trim().toLowerCase() === testName.trim().toLowerCase());
        if (existingTest) {
          existingTest.score = score;
          existingTest.totalMarks = Number(totalMarks);
          existingTest.date = date;
          existingTest.remarks = remark || '';
        } else {
          record.testResults.push({
            testName,
            score,
            totalMarks: Number(totalMarks),
            date,
            remarks: remark || ''
          });
        }
        
        await record.save();
      }
    }
    
    res.redirect(`/teacher/progress?batch=${batch}&course=${course}&saved=1`);
  } catch (err) {
    console.error('❌ Bulk Add Test Result Error:', err);
    res.redirect(`/teacher/progress?batch=${batch}&course=${course}&error=${encodeURIComponent(err.message)}`);
  }
};

/**
 * POST /teacher/progress/delete-test
 * Deletes a specific test by name from all student records in the selected batch and course.
 */
exports.postDeleteTest = async (req, res) => {
  const { course, batch, testName } = req.body;
  console.log('🗑️ Delete Test request:', { course, batch, testName });
  const mongoose = require('mongoose');

  if (!mongoose.Types.ObjectId.isValid(batch) || !mongoose.Types.ObjectId.isValid(course)) {
    return res.redirect('/teacher/progress?error=invalid_params');
  }

  try {
    const records = await Progress.find({ batch, course });
    for (const record of records) {
      record.testResults = record.testResults.filter(t => t.testName.trim().toLowerCase() !== testName.trim().toLowerCase());
      if (record.testResults.length === 0) {
        record.overallScore = 0;
      }
      await record.save();
    }
    res.redirect(`/teacher/progress?batch=${batch}&course=${course}&deleted=1`);
  } catch (err) {
    console.error('❌ Delete Test Error:', err);
    res.redirect(`/teacher/progress?batch=${batch}&course=${course}&error=${encodeURIComponent(err.message)}`);
  }
};