const User = require('../../models/User');
const Lead = require('../../models/Lead');
const Message = require('../../models/Message');
const Fee = require('../../models/Fee');
const logger = require('../../utils/logger');

const Student = require('../../models/Student');

/**
 * GET /counsellor/dashboard
 * Aggregates counsellor metrics, recent leads, scheduled follow-ups, and pending notifications.
 */
exports.getDashboard = async (req, res) => {
  try {
    const counsellorId = req.user.counsellorProfileId;
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 10+ sequential queries refactored into parallel lookups and aggregations where appropriate
    const [
      recentLeads,
      followupLeads,
      overdueCallbacks,
      todayCallbacks,
      enrolledStudents,
      statusStats,
      sourceStats,
      totalLeadsCount,
      newLeadsTodayCount,
      convertedLeadsCount,
      lostLeadsCount,
      admin,
      messages
    ] = await Promise.all([
      Lead.find({ assignedTo: counsellorId }).sort({ createdAt: -1 }).limit(10),
      Lead.find({
        assignedTo: counsellorId,
        followUpDate: { $lt: tomorrow },
        status: { $nin: ['admission_completed', 'lost'] }
      }).sort({ followUpDate: 1 }),
      Lead.find({
        assignedTo: counsellorId,
        followUpDate: { $lt: today },
        status: { $nin: ['admission_completed', 'lost'] }
      }).sort({ followUpDate: 1 }),
      Lead.find({
        assignedTo: counsellorId,
        followUpDate: { $gte: today, $lt: tomorrow },
        status: { $nin: ['admission_completed', 'lost'] }
      }).sort({ followUpDate: 1 }),
      Student.find({ counsellor: counsellorId }).populate('user'),
      Lead.aggregate([
        { $match: { assignedTo: counsellorId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Lead.aggregate([
        { $match: { assignedTo: counsellorId } },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]),
      Lead.countDocuments({ assignedTo: counsellorId }),
      Lead.countDocuments({
        assignedTo: counsellorId,
        createdAt: { $gte: today, $lt: tomorrow }
      }),
      Lead.countDocuments({ assignedTo: counsellorId, status: 'admission_completed' }),
      Lead.countDocuments({ assignedTo: counsellorId, status: 'lost' }),
      User.findOne({ role: 'admin' }),
      Message.find({ recipient: userId })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    // Compute fee callbacks (overdue payments) in parallel
    const studentIds = enrolledStudents.map(s => s._id);
    const studentFees = studentIds.length > 0 ? await Fee.find({ student: { $in: studentIds } }).populate('student') : [];
    const feeCallbacks = studentFees.filter(f => {
      const net = (f.totalAmount || 0) - (f.discount || 0);
      const due = Math.max(0, net - (f.paidAmount || 0));
      return f.student && due > 0 && f.dueDate && new Date(f.dueDate) < today;
    });

    const { computeSourceStats } = require('../../utils/leadAnalytics');
    // For lead quality analytics, we pass all leads loaded (or query if needed, but recentLeads and others are subset.
    // To be accurate, we do a full query for all leads, or reuse what is needed. We already count total.
    // Let's load the full minimal list of leads if we want to run computeSourceStats on all leads.
    // Or we can do a projection to save memory.
    const allLeadsForAnalytics = await Lead.find({ assignedTo: counsellorId }).select('status source course createdAt followUpHistory');
    const sourceStatsMap = computeSourceStats(allLeadsForAnalytics);

    const byStatus = { new: 0, contacted: 0, mentorship_scheduled: 0, mentorship_attended: 0, follow_up: 0, joining_interested: 0, admission_completed: 0, lost: 0 };
    statusStats.forEach(s => {
      byStatus[s._id] = s.count;
    });

    const bySource = {};
    sourceStats.forEach(s => {
      bySource[s._id] = s.count;
    });

    res.render('counsellor/dashboard', {
      title: 'Counsellor Dashboard',
      user: req.user,
      followupLeads,
      recentLeads,
      overdueCallbacks,
      todayCallbacks,
      feeCallbacks,
      sourceStats: sourceStatsMap,
      admin,
      messages,
      stats: {
        total: totalLeadsCount,
        newToday: newLeadsTodayCount,
        followupsDue: followupLeads.length,
        converted: convertedLeadsCount,
        lost: lostLeadsCount,
        byStatus,
        bySource
      }
    });
  } catch (err) {
    logger.error('Counsellor Dashboard Fetch Error', { err: err.message, stack: err.stack });
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

/**
 * POST /counsellor/messages/send
 * Handles message sending from counsellor.
 */
exports.postSendMessage = async (req, res) => {
  const { recipientId, content, redirect } = req.body;
  const safeRedirect = require('../../utils/safeRedirect');
  const targetRedirect = safeRedirect(redirect, '/counsellor/dashboard');
  logger.info('Counsellor sending message', { senderId: req.user._id, recipientId });
  try {
    const { validateAndSanitizeMessage } = require('../../utils/messageValidator');
    const { cleanContent } = await validateAndSanitizeMessage(req.user, recipientId, content);

    await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content: cleanContent,
    });
    res.redirect(targetRedirect.includes('?') ? `${targetRedirect}&posted=1` : `${targetRedirect}?posted=1`);
  } catch (err) {
    logger.error('Counsellor Send Message Error', { err: err.message });
    const errQuery = `error=${encodeURIComponent(err.message)}`;
    res.redirect(targetRedirect.includes('?') ? `${targetRedirect}&${errQuery}` : `${targetRedirect}?${errQuery}`);
  }
};
