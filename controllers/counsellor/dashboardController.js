const User = require('../../models/User');
const Lead = require('../../models/Lead');
const Message = require('../../models/Message');
const Fee = require('../../models/Fee');
const logger = require('../../utils/logger');

const Student = require('../../models/Student');
const Announcement = require('../../models/Announcement');
const { visibleToCounsellor } = require('../../utils/leadOwnership');

/**
 * GET /counsellor/dashboard
 * Aggregates counsellor metrics, recent leads, scheduled follow-ups, and pending notifications.
 */
exports.getDashboard = async (req, res) => {
  try {
    const modules = res.locals.modules || {};
    const leadsEnabled = modules.leads !== false;
    const studentsEnabled = modules.students !== false;
    const counsellorId = req.user.counsellorProfileId;
    const visibleLeads = visibleToCounsellor(counsellorId);
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

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
      messages,
      activeAnnouncements
    ] = await Promise.all([
      leadsEnabled ? Lead.find({ ...visibleLeads, createdAt: { $gte: threeDaysAgo } })
        .populate('interestedCourse', 'name')
        .sort({ createdAt: -1 }) : [],
      leadsEnabled ? Lead.find({
        ...visibleLeads,
        nextFollowUpAt: { $lt: tomorrow },
        status: { $nin: ['admission_completed', 'lost'] }
      }).populate('interestedCourse', 'name').sort({ nextFollowUpAt: 1 }) : [],
      leadsEnabled ? Lead.find({
        ...visibleLeads,
        nextFollowUpAt: { $lt: today },
        status: { $nin: ['admission_completed', 'lost'] }
      }).populate('interestedCourse', 'name').sort({ nextFollowUpAt: 1 }) : [],
      leadsEnabled ? Lead.find({
        ...visibleLeads,
        nextFollowUpAt: { $gte: today, $lt: tomorrow },
        status: { $nin: ['admission_completed', 'lost'] }
      }).populate('interestedCourse', 'name').sort({ nextFollowUpAt: 1 }) : [],
      studentsEnabled ? Student.find({ counsellor: counsellorId }).populate('user') : [],
      leadsEnabled ? Lead.aggregate([
        { $match: visibleLeads },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]) : [],
      leadsEnabled ? Lead.aggregate([
        { $match: visibleLeads },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]) : [],
      leadsEnabled ? Lead.countDocuments(visibleLeads) : 0,
      leadsEnabled ? Lead.countDocuments({
        ...visibleLeads,
        createdAt: { $gte: today, $lt: tomorrow }
      }) : 0,
      leadsEnabled ? Lead.countDocuments({ ...visibleLeads, status: 'admission_completed' }) : 0,
      leadsEnabled ? Lead.countDocuments({ ...visibleLeads, status: 'lost' }) : 0,
      User.findOne({ role: 'admin' }),
      Message.find({ recipient: userId })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 })
        .limit(5),
      modules.announcements === false ? [] : Announcement.find({
        isActive: true,
        $or: [
          { audienceType: 'all' },
          { audienceType: 'role', role: 'counsellor' }
        ]
      }).populate('createdBy', 'name role').sort({ createdAt: -1 }).limit(5)
    ]);

    const mappedAnnouncements = (activeAnnouncements || []).map(ann => ({
      _id: ann._id,
      content: `📢 [${ann.title}] ${ann.content}`,
      sender: ann.createdBy,
      createdAt: ann.createdAt,
      isAnnouncement: true,
      isRead: (ann.readBy || []).some(read => read.user && read.user.toString() === req.user._id.toString())
    }));

    const combinedMessages = [...mappedAnnouncements, ...(messages || [])];

    // Compute fee callbacks (overdue payments) in parallel
    const studentIds = enrolledStudents.map(s => s._id);
    const studentFees = modules.fees !== false && studentIds.length > 0 ? await Fee.find({ student: { $in: studentIds } }).populate('student') : [];
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
    const allLeadsForAnalytics = leadsEnabled ? await Lead.find(visibleLeads).select('status source interestedCourse createdAt followUpHistory') : [];
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
      messages: combinedMessages,
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
