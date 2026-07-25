const User = require('../../models/User');
const Counsellor = require('../../models/Counsellor');
const Lead = require('../../models/Lead');
const LeadActivity = require('../../models/LeadActivity');
const Message = require('../../models/Message');

const { escapeRegex, phoneSearchPattern } = require('../../utils/sanitize');
const { getLeadStatuses } = require('../../utils/leadStatusOptions');
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
      const phonePattern = phoneSearchPattern(search);

      userFilter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: phonePattern, $options: 'i' } }
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

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 25;
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const baseFilter = { assignedTo: counsellorProfile ? counsellorProfile._id : null };
    const leadFilter = { ...baseFilter };
    if (status) leadFilter.status = status;
    if (search) {
      const escaped = escapeRegex(search);
      leadFilter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: phoneSearchPattern(search), $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ];
    }

    const [leads, filteredTotal, messages, counsellorProfiles, leadStatuses, leadIds, totalLeads, convertedLeads, activeLeads, lostLeads] = await Promise.all([
      Lead.find(leadFilter)
        .populate('interestedCourse', 'name code')
        .populate('convertedStudent')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Lead.countDocuments(leadFilter),

      Message.find({ recipient: counsellorUser._id })
        .populate('sender', 'name role')
        .sort({ createdAt: -1 })
        .limit(50),

      Counsellor.find().populate({ path: 'user', match: { status: 'active' }, select: 'name' }),
      getLeadStatuses(),
      Lead.distinct('_id', baseFilter),
      Lead.countDocuments(baseFilter),
      Lead.countDocuments({ ...baseFilter, status: 'admission_completed' }),
      Lead.countDocuments({ ...baseFilter, status: { $nin: ['admission_completed', 'lost'] } }),
      Lead.countDocuments({ ...baseFilter, status: 'lost' })
    ]);

    const counsellors = counsellorProfiles
      .filter(profile => profile.user)
      .map(profile => ({ _id: profile._id, name: profile.user.name }));

    const followUps = await LeadActivity.countDocuments({
      lead: { $in: leadIds },
      type: { $in: [
        'follow_up_scheduled',
        'follow_up_completed',
        'call',
        'whatsapp',
        'note'
      ] }
    });

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
      leadStatuses,
      filter: { search, status },
      pagination: {
        page,
        limit,
        total: filteredTotal,
        pages: Math.max(Math.ceil(filteredTotal / limit), 1)
      },
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
