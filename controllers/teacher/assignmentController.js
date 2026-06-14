const User = require('../../models/User');
const Assignment = require('../../models/Assignment');
const Batch = require('../../models/Batch');
const Student = require('../../models/Student');

/**
 * GET /teacher/assignments
 * Lists all assignments created by this teacher (or all if admin), newest first.
 */
exports.getAssignments = async (req, res) => {
  console.log('📚 Teacher Assignments list load:', { teacherId: req.user._id });
  try {
    const filter = req.user.role === 'admin' ? {} : { teacher: req.user.teacherProfileId };
    const assignments = await Assignment.find(filter)
      .populate('course', 'name code')
      .populate('batch', 'name')
      .sort({ createdAt: -1 });
    console.log('✅ Assignments fetched:', { count: assignments.length });
    res.render('teacher/assignments', { title: 'Assignments', user: req.user, assignments });
  } catch (err) {
    console.error('❌ Teacher Assignments List Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * GET /teacher/assignments/create
 * Shows the assignment creation form pre-loaded with available student batches.
 */
exports.getCreateAssignment = async (req, res) => {
  console.log('📝 Create Assignment form load:', { teacherId: req.user._id });
  try {
    const Schedule = require('../../models/Schedule');
    const assignedBatches = await Schedule.distinct('batch', { teacher: req.user.teacherProfileId });
    const batches = await Batch.find({ _id: { $in: assignedBatches }, isActive: true });
    res.render('teacher/assignment-form', { title: 'New Assignment', user: req.user, target: null, batches });
  } catch (err) {
    console.error('❌ Create Assignment Form Load Error:', { teacherId: req.user._id, error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /teacher/assignments/create
 * Creates a new assignment. Saves an optional reference file if uploaded.
 */
exports.postCreateAssignment = async (req, res) => {
  console.log('📚 Create Assignment request:', {
    teacherId: req.user._id, title: req.body.title,
    batch: req.body.batch, dueDate: req.body.dueDate, hasFile: !!req.file,
  });
  try {
    const batchDoc = await Batch.findById(req.body.batch);
    const data = { 
      ...req.body, 
      teacher: req.user.teacherProfileId,
      course: batchDoc ? batchDoc.course : null,
      batch: batchDoc ? batchDoc._id : req.body.batch
    };
    if (req.file) {
      data.fileUrl = `/files/${req.file.filename}`;
      data.fileName = req.file.originalname;
    }
    const assign = await Assignment.create(data);
    console.log('✅ Assignment created successfully:', { assignmentId: assign._id, title: assign.title });
    res.redirect('/teacher/assignments?created=1');
  } catch (err) {
    console.error('❌ Create Assignment Error:', { teacherId: req.user._id, error: err.message });
    res.redirect('/teacher/assignments?error=1');
  }
};

/**
 * GET /teacher/assignments/:id
 * Shows the assignment detail page with a full per-student submission breakdown.
 * Each student in the batch is listed whether they submitted or not.
 * Submission status: pending / submitted / late / graded / overdue.
 * Optionally filtered by status via query param.
 */
exports.getAssignmentDetail = async (req, res) => {
  console.log('📄 Assignment Detail load:', { teacherId: req.user._id, assignmentId: req.params.id });
  try {
    const assignment = await Assignment.findOne({ _id: req.params.id, teacher: req.user.teacherProfileId })
      .populate('submissions.student', 'name batch');

    if (!assignment) {
      console.warn('⚠️ Assignment not found or not owned by teacher:', { assignmentId: req.params.id });
      return res.redirect('/teacher/assignments');
    }

    const { status } = req.query;
    
    // Find all active students in the batch via Student profile
    const studentProfiles = await Student.find({ batch: assignment.batch })
      .populate('user');
    const activeStudents = studentProfiles
      .filter(sp => sp.user && sp.user.isActive)
      .map(sp => sp.user)
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Find any students who submitted the assignment (even if currently completed/inactive)
    const submittedStudentIds = assignment.submissions.map(s => s.student).filter(Boolean);
    const submittedStudents = await User.find({ _id: { $in: submittedStudentIds } });

    // Combine uniquely: all active batch students + any inactive students who submitted
    const studentMap = new Map();
    activeStudents.forEach(s => studentMap.set(s._id.toString(), s));
    submittedStudents.forEach(s => {
      if (!studentMap.has(s._id.toString())) {
        studentMap.set(s._id.toString(), s);
      }
    });

    const studentsToProcess = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    const now = new Date();
    const dueDate = new Date(assignment.dueDate);

    let allSubmissions = studentsToProcess.map(student => {
      const profile = studentProfiles.find(sp => sp.user && sp.user._id.toString() === student._id.toString());
      const studentProfileId = profile ? profile._id.toString() : null;

      const sub = assignment.submissions.find(
        s => s.student && (s.student._id || s.student).toString() === studentProfileId
      );

      if (sub) {
        let subState = sub.status || 'submitted';
        if (subState === 'submitted' && new Date(sub.submittedAt) > dueDate) subState = 'late';
        return {
          student, hasSubmitted: true, submissionId: sub._id,
          submittedAt: sub.submittedAt, fileUrl: sub.fileUrl, fileName: sub.fileName,
          note: sub.note, marks: sub.marks, feedback: sub.feedback, status: subState,
        };
      }

      return {
        student, hasSubmitted: false, submissionId: null,
        submittedAt: null, fileUrl: null, fileName: null,
        note: null, marks: null, feedback: null,
        status: now > dueDate ? 'overdue' : 'pending',
      };
    });

    // Compute status counts before filtering
    const counts = {
      all: allSubmissions.length,
      pending: allSubmissions.filter(s => s.status === 'pending').length,
      submitted: allSubmissions.filter(s => s.status === 'submitted').length,
      graded: allSubmissions.filter(s => s.status === 'graded').length,
      late: allSubmissions.filter(s => s.status === 'late').length,
      overdue: allSubmissions.filter(s => s.status === 'overdue').length
    };

    if (status) {
      allSubmissions = allSubmissions.filter(s => s.status === status);
    }

    res.render('teacher/assignment-detail', {
      title: assignment.title, user: req.user, assignment, submissions: allSubmissions, filter: req.query, counts
    });
  } catch (err) {
    console.error('❌ Get Assignment Detail Error:', { assignmentId: req.params.id, error: err.message });
    res.redirect('/teacher/assignments?error=1');
  }
};

/**
 * POST /teacher/assignments/:id/grade/:subId
 * Grades a single student's submission — sets marks, feedback, and status.
 * Uses MongoDB's positional $ operator to update the embedded subdocument.
 */
exports.postGradeSubmission = async (req, res) => {
  const { marks, feedback, status } = req.body;
  console.log('💯 Grade Submission request:', {
    teacherId: req.user._id, assignmentId: req.params.id,
    submissionId: req.params.subId, marks: Number(marks), status,
  });
  try {
    await Assignment.updateOne(
      { _id: req.params.id, 'submissions._id': req.params.subId },
      {
        $set: {
          'submissions.$.marks': Number(marks),
          'submissions.$.feedback': feedback,
          'submissions.$.status': status || 'graded',
        },
      }
    );
    console.log('✅ Submission graded successfully:', { submissionId: req.params.subId });
    res.redirect(`/teacher/assignments/${req.params.id}?graded=1`);
  } catch (err) {
    console.error('❌ Grade Submission Error:', { submissionId: req.params.subId, error: err.message });
    res.redirect(`/teacher/assignments/${req.params.id}?error=1`);
  }
};

/**
 * POST /teacher/assignments/:id/extend
 * Extends the due date of a specific assignment.
 */
exports.postExtendDueDate = async (req, res) => {
  const { dueDate } = req.body;
  console.log('📅 Extend Assignment Deadline request:', { teacherId: req.user._id, assignmentId: req.params.id, dueDate });
  try {
    const assignment = await Assignment.findOne({ _id: req.params.id, teacher: req.user.teacherProfileId });
    if (!assignment) {
      return res.redirect('/teacher/assignments');
    }
    assignment.dueDate = new Date(dueDate);
    await assignment.save();
    console.log('✅ Assignment due date extended:', { assignmentId: assignment._id, newDueDate: assignment.dueDate });
    res.redirect(`/teacher/assignments/${assignment._id}?extended=1`);
  } catch (err) {
    console.error('❌ Extend Due Date Error:', err);
    res.redirect(`/teacher/assignments/${req.params.id}?error=1`);
  }
};