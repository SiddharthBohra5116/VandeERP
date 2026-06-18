const LeaveRequest = require('../../models/LeaveRequest');
const logger = require('../../utils/logger');

/**
 * GET /counsellor/leaves
 * Renders counsellor's leave requests page.
 */
exports.getLeavesPage = async (req, res) => {
  try {
    const leaves = await LeaveRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.render('counsellor/leaves', { title: 'Leave Requests', user: req.user, leaves });
  } catch (err) {
    logger.error('Counsellor Get Leaves Page Error', { err: err.message });
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

/**
 * POST /counsellor/leaves/apply
 * Applies for leave for counsellor (uses teacher field under the hood for model uniformity).
 */
exports.postApplyLeave = async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  try {
    await LeaveRequest.create({ user: req.user._id, startDate, endDate, reason });
    res.redirect('/counsellor/leaves?created=1');
  } catch (err) {
    logger.error('Counsellor Apply Leave Error', { err: err.message });
    res.redirect('/counsellor/leaves?error=1');
  }
};
