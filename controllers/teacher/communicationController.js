const Message = require('../../models/Message');
const Schedule = require('../../models/Schedule');
const LeaveRequest = require('../../models/LeaveRequest');
const logger = require('../../utils/logger');

// ─── MESSAGING ────────────────────────────────────────────────────────────────

/**
 * POST /teacher/messages/send
 * Sends a message from the teacher to any recipient (admin or student).
 * The redirect param in the form body controls the post-submit destination.
 */
exports.postSendMessage = async (req, res) => {
  const { recipientId, content, redirect } = req.body;
  console.log('💬 Teacher sending message:', { senderId: req.user._id, recipientId });
  try {
    const { validateAndSanitizeMessage } = require('../../utils/messageValidator');
    const { cleanContent } = await validateAndSanitizeMessage(req.user, recipientId, content);
    await Message.create({ sender: req.user._id, recipient: recipientId, content: cleanContent });
    res.redirect(`${redirect || '/teacher/dashboard'}?posted=1`);
  } catch (err) {
    console.error('❌ Teacher Send Message Error:', { senderId: req.user._id, error: err.message });
    res.redirect(`${redirect || '/teacher/dashboard'}?error=${encodeURIComponent(err.message)}`);
  }
};

// ─── LEAVE REQUESTS ───────────────────────────────────────────────────────────

/**
 * GET /teacher/leaves
 * Lists all leave requests submitted by this teacher, newest first.
 */
exports.getLeavesPage = async (req, res) => {
  try {
    const leaves = await LeaveRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.render('teacher/leaves', { title: 'Leave Requests', user: req.user, leaves });
  } catch (err) {
    console.error('❌ Get Leaves Page Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

/**
 * POST /teacher/leaves/apply
 * Submits a new leave request for the teacher covering startDate to endDate.
 */
exports.postApplyLeave = async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    if (!startDate || !endDate || !reason) {
      return res.redirect('/teacher/leaves?error=1');
    }
    if (startDate < todayStr || endDate < startDate) {
      return res.redirect('/teacher/leaves?invalid_dates=1');
    }
    await LeaveRequest.create({ user: req.user._id, startDate, endDate, reason });
    res.redirect('/teacher/leaves?created=1');
  } catch (err) {
    console.error('❌ Apply Leave Error:', err);
    res.redirect('/teacher/leaves?error=1');
  }
};

// ─── SCHEDULE COMPLETION ──────────────────────────────────────────────────────

/**
 * POST /teacher/schedules/:id/complete
 * Marks a scheduled class as completed and optionally saves a lesson note.
 * Only accessible to the teacher assigned to the schedule.
 */
exports.postCompleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findOne({ _id: req.params.id, teacher: req.user.teacherProfileId });
    if (!schedule) {
      logger.warn('Unauthorized complete schedule request by teacher', { scheduleId: req.params.id });
      return res.status(403).render('403', { title: 'Access Denied', user: req.user });
    }
    schedule.status = 'completed';
    schedule.note = req.body.note || '';
    await schedule.save();
    logger.info('Schedule marked complete by teacher', { scheduleId: schedule._id });
    res.redirect(`/teacher/updates/create?schedule=${schedule._id}&completed=1`);
  } catch (err) {
    logger.error('Complete Schedule Error', { err: err.message });
    res.redirect('/teacher/dashboard?error=1');
  }
};
