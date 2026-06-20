const User = require('../../models/User');
const Assignment = require('../../models/Assignment');
const Batch = require('../../models/Batch');
const Student = require('../../models/Student');
const Message = require('../../models/Message');
const mongoose = require('mongoose');

async function notifyBatchStudents({ teacherId, batchId, content }) {
  const students = await Student.find({ batch: batchId }).populate('user', '_id status');
  const notifications = students
    .filter(student => student.user && student.user.status === 'active')
    .map(student => Message.create({
      sender: teacherId,
      recipient: student.user._id,
      content
    }));

  await Promise.all(notifications);
}

function isSubmittedWork(submission) {
  return ['submitted', 'late', 'graded'].includes(submission.status) || !!submission.fileUrl || !!submission.submittedAt;
}

function isUngradedSubmission(submission) {
  return ['submitted', 'late'].includes(submission.status) && submission.marks === null;
}

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
    const batchIds = [...new Set(assignments
      .map(a => a.batch?._id || a.batch)
      .filter(Boolean)
      .map(String))];
    const studentCounts = batchIds.length
      ? await Student.aggregate([
        { $match: { batch: { $in: batchIds.map(id => new mongoose.Types.ObjectId(id)) } } },
        { $group: { _id: '$batch', count: { $sum: 1 } } }
      ])
      : [];
    const batchCountMap = new Map(studentCounts.map(item => [String(item._id), item.count]));
    const assignmentCards = assignments.map(assignment => {
      const batchId = assignment.batch?._id || assignment.batch;
      const totalStudents = batchId ? (batchCountMap.get(String(batchId)) || 0) : 0;
      const handinsCount = assignment.submissions.filter(isSubmittedWork).length;
      const gradedCount = assignment.submissions.filter(s => s.status === 'graded' || s.marks !== null).length;
      const ungradedCount = assignment.submissions.filter(isUngradedSubmission).length;
      return { assignment, totalStudents, handinsCount, gradedCount, ungradedCount };
    });
    console.log('✅ Assignments fetched:', { count: assignments.length });
    res.render('teacher/assignments', { title: 'Assignments', user: req.user, assignments, assignmentCards });
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
    const dueDate = new Date(req.body.dueDate);
    if (!req.body.dueDate || Number.isNaN(dueDate.getTime()) || dueDate <= new Date()) {
      return res.redirect('/teacher/assignments/create?error=Assignment+deadline+must+be+in+the+future');
    }

    const batchDoc = await Batch.findById(req.body.batch);
    const data = { 
      ...req.body, 
      dueDate,
      teacher: req.user.teacherProfileId,
      course: batchDoc ? batchDoc.course : null,
      batch: batchDoc ? batchDoc._id : req.body.batch
    };
    if (req.file) {
      data.fileUrl = `/files/${req.file.filename}`;
      data.fileName = req.file.originalname;
    }
    const assign = await Assignment.create(data);
    await notifyBatchStudents({
      teacherId: req.user._id,
      batchId: assign.batch,
      content: `New assignment posted: "${assign.title}". Due date: ${new Date(assign.dueDate).toLocaleDateString('en-IN')}.`
    });
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
      .populate('batch', 'name')
      .populate({
        path: 'submissions.student',
        populate: { path: 'user', select: 'name status' }
      });

    if (!assignment) {
      console.warn('⚠️ Assignment not found or not owned by teacher:', { assignmentId: req.params.id });
      return res.redirect('/teacher/assignments');
    }

    const { status } = req.query;
    
    // Find all active students in the batch via Student profile
    const studentProfiles = await Student.find({ batch: assignment.batch?._id || assignment.batch })
      .populate('user')
      .populate('batch', 'name');
    const activeStudentProfiles = studentProfiles
      .filter(sp => sp.user && sp.user.isActive)
      .sort((a, b) => spDisplayName(a).localeCompare(spDisplayName(b)));
    
    // Find any students who submitted the assignment (even if currently completed/inactive)
    const submittedStudentIds = assignment.submissions.map(s => s.student).filter(Boolean);
    const submittedProfiles = await Student.find({ _id: { $in: submittedStudentIds } })
      .populate('user')
      .populate('batch', 'name');

    // Combine uniquely: all active batch students + any inactive students who submitted
    const studentMap = new Map();
    activeStudentProfiles.forEach(sp => studentMap.set(sp._id.toString(), sp));
    submittedProfiles.forEach(sp => {
      if (!studentMap.has(sp._id.toString())) {
        studentMap.set(sp._id.toString(), sp);
      }
    });

    const studentsToProcess = Array.from(studentMap.values()).sort((a, b) => spDisplayName(a).localeCompare(spDisplayName(b)));

    const now = new Date();
    const dueDate = new Date(assignment.dueDate);

    let allSubmissions = studentsToProcess.map(profile => {
      const studentProfileId = profile._id.toString();
      const student = {
        _id: profile.user?._id || profile._id,
        name: profile.user?.name || 'Deleted Student',
        status: profile.user?.status || profile.status,
        batch: profile.batch || assignment.batch || null
      };

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

function spDisplayName(studentProfile) {
  return studentProfile?.user?.name || 'Deleted Student';
}

/**
 * POST /teacher/assignments/:id/grade/:subId
 * Grades a single student's submission — sets marks, feedback, and status.
 * Uses MongoDB's positional $ operator to update the embedded subdocument.
 */
exports.postGradeSubmission = async (req, res) => {
  const { marks, feedback } = req.body;
  console.log('💯 Grade Submission request:', {
    teacherId: req.user._id, assignmentId: req.params.id,
    submissionId: req.params.subId, marks: Number(marks),
  });
  try {
    const assignment = await Assignment.findOne({
      _id: req.params.id,
      teacher: req.user.teacherProfileId,
      'submissions._id': req.params.subId
    }).populate({
      path: 'submissions.student',
      populate: { path: 'user', select: '_id status' }
    });

    if (!assignment) {
      return res.redirect('/teacher/assignments?error=1');
    }

    const submission = assignment.submissions.id(req.params.subId);
    const numericMarks = Number(marks);
    if (!Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > assignment.totalMarks) {
      return res.redirect(`/teacher/assignments/${req.params.id}?error=Invalid+marks`);
    }

    await Assignment.updateOne(
      { _id: req.params.id, 'submissions._id': req.params.subId },
      {
        $set: {
          'submissions.$.marks': numericMarks,
          'submissions.$.feedback': feedback,
          'submissions.$.status': 'graded',
        },
      }
    );
    if (submission?.student?.user && submission.student.user.status === 'active') {
      const markText = `${numericMarks} / ${assignment.totalMarks}`;
      const feedbackText = feedback && feedback.trim()
        ? `\nFeedback: ${feedback.trim()}`
        : '\nFeedback: No written feedback added.';

      await Message.create({
        sender: req.user._id,
        recipient: submission.student.user._id,
        content:
          `Assignment graded: "${assignment.title}"\n` +
          `Score: ${markText}\n` +
          `Status: graded\n` +
          `${feedbackText}\n` +
          'Open Student Portal > Assignments to review the result.'
      });
    }
    console.log('✅ Submission graded successfully:', { submissionId: req.params.subId });
    res.redirect(`/teacher/assignments/${req.params.id}?graded=1`);
  } catch (err) {
    console.error('❌ Grade Submission Error:', { submissionId: req.params.subId, error: err.message });
    res.redirect(`/teacher/assignments/${req.params.id}?error=1`);
  }
};

/**
 * POST /teacher/assignments/:id/bulk-grade
 * Grades multiple submitted assignment rows in one save. Blank marks are skipped
 * so teachers can fill only the students they are ready to grade.
 */
exports.postBulkGradeSubmissions = async (req, res) => {
  const grades = req.body.grades || {};

  try {
    const assignment = await Assignment.findOne({
      _id: req.params.id,
      teacher: req.user.teacherProfileId
    }).populate({
      path: 'submissions.student',
      populate: { path: 'user', select: '_id status' }
    });

    if (!assignment) {
      return res.redirect('/teacher/assignments?error=1');
    }

    let updatedCount = 0;
    const messages = [];

    Object.entries(grades).forEach(([submissionId, payload]) => {
      const marksRaw = payload && payload.marks;
      if (marksRaw === undefined || marksRaw === null || String(marksRaw).trim() === '') return;

      const marks = Number(marksRaw);
      if (!Number.isFinite(marks) || marks < 0 || marks > assignment.totalMarks) return;

      const submission = assignment.submissions.id(submissionId);
      if (!submission) return;

      submission.marks = marks;
      submission.feedback = payload.feedback || '';
      submission.status = 'graded';
      updatedCount++;

      if (submission.student?.user && submission.student.user.status === 'active') {
        const feedbackText = submission.feedback && submission.feedback.trim()
          ? `\nFeedback: ${submission.feedback.trim()}`
          : '\nFeedback: No written feedback added.';
        messages.push({
          sender: req.user._id,
          recipient: submission.student.user._id,
          content:
            `Assignment graded: "${assignment.title}"\n` +
            `Score: ${marks} / ${assignment.totalMarks}\n` +
            `Status: graded\n` +
            `${feedbackText}\n` +
            'Open Student Portal > Assignments to review the result.'
        });
      }
    });

    if (updatedCount === 0) {
      return res.redirect(`/teacher/assignments/${req.params.id}?bulk_empty=1`);
    }

    await assignment.save();
    if (messages.length > 0) {
      await Message.insertMany(messages);
    }

    res.redirect(`/teacher/assignments/${req.params.id}?bulk_graded=${updatedCount}`);
  } catch (err) {
    console.error('âŒ Bulk Grade Submissions Error:', { assignmentId: req.params.id, error: err.message });
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
    const nextDueDate = new Date(dueDate);
    if (!dueDate || Number.isNaN(nextDueDate.getTime()) || nextDueDate <= new Date()) {
      return res.redirect(`/teacher/assignments/${req.params.id}?error=New+deadline+must+be+in+the+future`);
    }

    const assignment = await Assignment.findOne({ _id: req.params.id, teacher: req.user.teacherProfileId });
    if (!assignment) {
      return res.redirect('/teacher/assignments');
    }
    assignment.dueDate = nextDueDate;
    await assignment.save();
    await notifyBatchStudents({
      teacherId: req.user._id,
      batchId: assignment.batch,
      content: `Assignment deadline updated: "${assignment.title}" is now due on ${assignment.dueDate.toLocaleDateString('en-IN')}.`
    });
    console.log('✅ Assignment due date extended:', { assignmentId: assignment._id, newDueDate: assignment.dueDate });
    res.redirect(`/teacher/assignments/${assignment._id}?extended=1`);
  } catch (err) {
    console.error('❌ Extend Due Date Error:', err);
    res.redirect(`/teacher/assignments/${req.params.id}?error=1`);
  }
};
