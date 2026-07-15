const User = require('../../models/User');
const Counsellor = require('../../models/Counsellor');
const Lead = require('../../models/Lead');
const LeadActivity = require('../../models/LeadActivity');
const Message = require('../../models/Message');

const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../utils/logger');


// GET /admin/counsellors
exports.getCounsellors = async (req, res) => {
  try {
    const { search } = req.query;

    const userFilter = {
      role: 'counsellor',
      archivedAt: null
    };

    if (search) {
      const escaped = escapeRegex(search);

      userFilter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } }
      ];
    }

    const users = await User.find(userFilter).sort({ createdAt: -1 });
    const userIds = users.map(user => user._id);

    const counsellorProfiles = await Counsellor.find({
      user: { $in: userIds }
    }).populate('user', 'name email phone status profilePic');

    const counsellorProfileMap = new Map(
      counsellorProfiles
        .filter(profile => profile.user)
        .map(profile => [
          String(profile.user._id),
          profile
        ])
    );

    const mergedCounsellors = users.map(user => {
      const plainUser = user.toObject();
      const profile = counsellorProfileMap.get(String(user._id));

      return {
        ...plainUser,
        counsellorProfile: profile || null,
        rollNumber: profile?.rollNumber || plainUser.rollNumber || ''
      };
    });

    res.render('admin/users', {
      title: 'Manage Counsellors',
      user: req.user,
      users: mergedCounsellors,
      roleActive: 'counsellor',
      page: 'counsellors',
      filter: req.query
    });

  } catch (err) {
    logger.error('getCounsellors Error', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};


// GET /admin/counsellors/:id
exports.getCounsellorProfile = async (req, res) => {
  try {
    const counsellorUser = await User.findById(req.params.id);

    if (!counsellorUser || counsellorUser.role !== 'counsellor') {
      return res.redirect('/admin/counsellors');
    }

    const counsellorProfile = await Counsellor.findOne({
      user: counsellorUser._id
    });

    const [leads, messages, counsellors] = await Promise.all([
      Lead.find({ assignedTo: counsellorProfile ? counsellorProfile._id : null })
        .populate('interestedCourse', 'name code')
        .populate('convertedStudent')
        .sort({ createdAt: -1 }),

      Message.find({ recipient: counsellorUser._id })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 }),

      User.find({
        role: 'counsellor',
        status: 'active'
      }).select('name')
    ]);

    const leadIds = leads.map(lead => lead._id);

    const activities = await LeadActivity.find({
      lead: { $in: leadIds }
    });

    const totalLeads = leads.length;

    const convertedLeads = leads.filter(
      lead => lead.status === 'admission_completed'
    ).length;

    const activeLeads = leads.filter(
      lead => !['admission_completed', 'lost'].includes(lead.status)
    ).length;

    const lostLeads = leads.filter(
      lead => lead.status === 'lost'
    ).length;

    const followUps = activities.filter(activity =>
      [
        'follow_up_scheduled',
        'follow_up_completed',
        'call',
        'whatsapp',
        'note'
      ].includes(activity.type)
    ).length;

    const conversionRate = totalLeads > 0
      ? Math.round((convertedLeads / totalLeads) * 100)
      : 0;

    const counsellor = {
      ...counsellorUser.toObject(),
      counsellorProfile,
      rollNumber: counsellorProfile?.rollNumber || counsellorUser.rollNumber || ''
    };

    res.render('admin/counsellor-profile', {
      title: `${counsellorUser.name} — Profile`,
      user: req.user,
      counsellor,
      leads,
      messages,
      counsellors,
      stats: {
        totalLeads,
        convertedLeads,
        activeLeads,
        lostLeads,
        followUps,
        conversionRate
      }
    });

  } catch (err) {
    logger.error('Counsellor Profile Fetch Error', {
      err: err.message,
      stack: err.stack
    });

    res.status(500).render('500', {
      title: 'Error',
      user: req.user,
      layout: 'main'
    });
  }
};
