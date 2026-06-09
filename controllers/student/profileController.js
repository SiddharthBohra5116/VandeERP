const User = require('../../models/User');
const Message = require('../../models/Message');
const logger = require('../../utils/logger');

// ─── MESSAGING ────────────────────────────────────────────────────────────────

/**
 * POST /student/messages/send
 * Sends a message from the student to admin, counsellor, or teacher.
 * Validates and sanitises content before persisting.
 */
exports.postSendMessage = async (req, res) => {
  const { recipientId, content, redirect } = req.body;
  logger.info('Student sending message', { senderId: req.user._id, recipientId });
  try {
    const { validateAndSanitizeMessage } = require('../../utils/messageValidator');
    const { cleanContent } = await validateAndSanitizeMessage(req.user, recipientId, content);

    await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content: cleanContent,
    });
    res.redirect(`${redirect || '/student/dashboard'}?posted=1`);
  } catch (err) {
    logger.error('Student Send Message Error', { error: err.message });
    res.redirect(`${redirect || '/student/dashboard'}?error=${encodeURIComponent(err.message)}`);
  }
};

// ─── PROFILE ─────────────────────────────────────────────────────────────────

/**
 * POST /student/profile/upload-id
 * Allows a student to upload their ID proof document.
 * Resets idVerified to false so admin must re-verify after a new upload.
 */
exports.postUploadIdProof = async (req, res) => {
  try {
    if (!req.file) return res.redirect('/auth/profile?error=1');

    const student = await User.findById(req.user._id);
    student.idProof = `/files/${req.file.filename}`;
    student.idVerified = false;
    await student.save();

    logger.info('Student uploaded ID proof', { studentId: student._id, path: student.idProof });
    res.redirect('/auth/profile?saved=1');
  } catch (err) {
    logger.error('Upload ID Proof Error', { error: err.message });
    res.redirect('/auth/profile?error=1');
  }
};

// ─── FEEDBACK ────────────────────────────────────────────────────────────────

/**
 * POST /student/feedback
 * Submits the course completion feedback form.
 * Once submitted, the feedback.submitted flag is set and the form is locked.
 */
exports.postSubmitFeedback = async (req, res) => {
  try {
    const { teacherRating, contentRating, facilitiesRating, comments } = req.body;
    const student = await User.findById(req.user._id);

    const tRate = Number(teacherRating) || 0;
    const cRate = Number(contentRating) || 0;
    const fRate = Number(facilitiesRating) || 0;

    if (tRate < 1 || tRate > 5 || cRate < 1 || cRate > 5 || fRate < 1 || fRate > 5) {
      return res.redirect('/student/dashboard?error=Ratings+must+be+between+1+and+5');
    }

    student.feedback = {
      submitted: true,
      teacherRating: tRate,
      contentRating: cRate,
      facilitiesRating: fRate,
      comments: comments || '',
      submittedAt: new Date(),
    };

    await student.save();
    logger.info('Student submitted course feedback', { studentId: student._id });
    res.redirect('/student/dashboard?saved=1');
  } catch (err) {
    logger.error('Submit Feedback Error', { error: err.message });
    res.redirect('/student/dashboard?error=1');
  }
};

// ─── CERTIFICATE ──────────────────────────────────────────────────────────────

/**
 * GET /student/certificate
 * Renders the graduation certificate for students whose status is 'complete'
 * AND who have submitted their course feedback. Rendered layout-free for print.
 */
exports.getCertificate = async (req, res) => {
  try {
    const student = await User.findById(req.user._id);
    if (!student || student.status !== 'complete' || !student.feedback?.submitted) {
      return res.redirect('/student/dashboard?error=Certificate not unlocked yet');
    }

    const completeEntry = student.statusHistory.find(h => h.status === 'complete');
    const completionDate = completeEntry ? completeEntry.date : student.updatedAt || new Date();

    res.render('admin/certificate', {
      title: `${student.name} — Graduation Certificate`,
      layout: false,
      student,
      completionDate,
    });
  } catch (err) {
    logger.error('Student Get Certificate Error', { error: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};