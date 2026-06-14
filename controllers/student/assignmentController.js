const Assignment = require('../../models/Assignment');
const Student = require('../../models/Student');

/**
 * GET /student/assignments
 * Lists all active assignments for the student's batch, enriched with their
 * own submission status (submitted / pending / late / graded).
 */
exports.getAssignments = async (req, res) => {
  try {
    const studentProfile = await Student.findOne({ user: req.user._id });
    const isKycIncomplete = !studentProfile;
    if (isKycIncomplete) {
      return res.status(403).render('403', {
        title: 'Access Restricted',
        user: req.user,
        error: 'Complete your profile KYC (Identity proof, Father\'s Name, Guardian Phone) on the dashboard to access assignments.'
      });
    }

    if (!req.user.batch) {
      return res.render('student/assignments', { title: 'Assignments', user: req.user, assignments: [] });
    }

    const assignments = await Assignment.find({ batch: req.user.batch, isActive: true }).sort({ dueDate: 1 });
    const userId = studentProfile._id.toString();

    const enriched = assignments.map(a => ({
      ...a.toJSON(),
      mySubmission: a.submissions.find(s => s.student.toString() === userId) || null,
    }));

    res.render('student/assignments', { title: 'Assignments', user: req.user, assignments: enriched });
  } catch (err) {
    console.error('❌ Student Assignments Fetch Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /student/assignments/:id/submit
 * Submits an assignment. Prevents duplicate submissions.
 * Flags submission as 'late' automatically if current time is past the due date.
 */
exports.postSubmitAssignment = async (req, res) => {
  const { note } = req.body;
  console.log('📚 Student assignment submission request:', {
    studentId: studentProfile._id,
    assignmentId: req.params.id,
  });
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.redirect('/student/assignments');

    const alreadySubmitted = assignment.submissions.find(
      s => s.student.toString() === studentProfile._id.toString()
    );
    if (alreadySubmitted) {
      console.log('⚠️ Student assignment already submitted:', {
        studentId: studentProfile._id,
        assignmentId: req.params.id,
      });
      return res.redirect('/student/assignments?already=1');
    }

    const now = new Date();
    const isLate = now > new Date(assignment.dueDate);

    const sub = {
      student: studentProfile._id,
      note,
      submittedAt: now,
      status: isLate ? 'late' : 'submitted',
    };
    if (req.file) {
      sub.fileUrl = `/files/${req.file.filename}`;
      sub.fileName = req.file.originalname;
    }

    assignment.submissions.push(sub);
    await assignment.save();
    console.log('✅ Student assignment submitted successfully:', {
      student: studentProfile._id,
      assignmentId: req.params.id,
    });
    res.redirect('/student/assignments?submitted=1');
  } catch (err) {
    console.error('❌ Student assignment submission error:', err);
    res.redirect('/student/assignments?error=1');
  }
};