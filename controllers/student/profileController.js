const User = require('../../models/User');
const Student = require('../../models/Student');
const Message = require('../../models/Message');
const logger = require('../../utils/logger');
const { storeUploadedFiles, discardStoredFiles } = require('../../utils/announcementStorage');

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

    const studentProfile = await Student.findOne({ user: req.user._id });
    if (!studentProfile) return res.redirect('/auth/profile?error=1');
    const [uploadedFile] = await storeUploadedFiles([req.file], 'id-proofs');
    studentProfile.documents.idProof = uploadedFile.url;
    studentProfile.documents.idProofPublicId = uploadedFile.publicId;
    studentProfile.documents.idProofResourceType = uploadedFile.resourceType;
    studentProfile.documents.idProofDeliveryType = uploadedFile.deliveryType;
    studentProfile.idVerified = false;
    try {
      await studentProfile.save();
    } catch (error) {
      await discardStoredFiles([uploadedFile]);
      throw error;
    }

    logger.info('Student uploaded ID proof', { studentId: studentProfile._id, path: studentProfile.documents.idProof });
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
    const studentProfile = await Student.findOne({ user: req.user._id });
    if (!studentProfile) return res.redirect('/student/dashboard?error=1');

    const tRate = Number(teacherRating) || 0;
    const cRate = Number(contentRating) || 0;
    const fRate = Number(facilitiesRating) || 0;

    if (tRate < 1 || tRate > 5 || cRate < 1 || cRate > 5 || fRate < 1 || fRate > 5) {
      return res.redirect('/student/dashboard?error=Ratings+must+be+between+1+and+5');
    }

    studentProfile.feedback = {
      submitted: true,
      teacherRating: tRate,
      contentRating: cRate,
      facilitiesRating: fRate,
      comments: comments || '',
      submittedAt: new Date(),
    };

    await studentProfile.save();
    logger.info('Student submitted course feedback', { studentId: studentProfile._id });
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
    const studentProfile = await Student.findOne({ user: req.user._id })
      .populate('user', 'name status statusHistory')
      .populate('course', 'name code')
      .populate('batch', 'name');

    if (!studentProfile || !studentProfile.user || studentProfile.user.status !== 'complete' || !studentProfile.feedback?.submitted) {
      return res.redirect('/student/dashboard?error=Certificate not unlocked yet');
    }

    const completeEntry = studentProfile.statusHistory.find(h => h.status === 'complete');
    const completionDate = completeEntry ? completeEntry.date : studentProfile.updatedAt || new Date();

    const student = studentProfile.toObject();
    student.name = studentProfile.user.name;
    student.course = studentProfile.course?.name || '';
    student.batch = studentProfile.batch?.name || '';

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
