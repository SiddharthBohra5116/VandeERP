const User = require('../../models/User');
const Assignment = require('../../models/Assignment');

/**
 * GET /teacher/assignments
 * Lists all assignments created by this teacher (or all if admin), newest first.
 */
exports.getAssignments = async (req, res) => {
  console.log('📚 Teacher Assignments list load:', { teacherId: req.user._id });
  try {
    const filter = req.user.role === 'admin' ? {} : { teacher: req.user._id };
    const assignments = await Assignment.find(filter).sort({ createdAt: -1 });
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
    const batches = await User.distinct('batch', { role: 'student', isActive: true });
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
    const data = { ...req.body, teacher: req.user._id };
    if (req.file) {
      data.fileUrl = `/uploads/${req.file.filename}`;
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
    const assignment = await Assignment.findOne({ _id: req.params.id, teacher: req.user._id })
      .populate('submissions.student', 'name batch');

    if (!assignment) {
      console.warn('⚠️ Assignment not found or not owned by teacher:', { assignmentId: req.params.id });
      return res.redirect('/teacher/assignments');
    }

    const { status } = req.query;
    const batchStudents = await User.find({ role: 'student', batch: assignment.batch, isActive: true }).sort({ name: 1 });

    const now = new Date();
    const dueDate = new Date(assignment.dueDate);

    let allSubmissions = batchStudents.map(student => {
      const sub = assignment.submissions.find(
        s => s.student && s.student._id.toString() === student._id.toString()
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

    if (status) {
      allSubmissions = allSubmissions.filter(s => s.status === status);
    }

    res.render('teacher/assignment-detail', {
      title: assignment.title, user: req.user, assignment, submissions: allSubmissions, filter: req.query,
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