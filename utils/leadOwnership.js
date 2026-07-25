const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');

const visibleToCounsellor = counsellorId => ({
  archivedAt: null,
  $or: [{ assignedTo: counsellorId }, { assignedTo: null }]
});

const claimLead = async (req, res, next) => {
  try {
    const counsellorId = req.user.counsellorProfileId;
    const claimed = await Lead.findOneAndUpdate(
      { _id: req.params.id, assignedTo: null },
      {
        $set: { assignedTo: counsellorId },
        $push: {
          ownershipHistory: {
            counsellor: counsellorId,
            assignedBy: req.user._id,
            note: 'Automatically assigned when counsellor updated the lead.'
          }
        }
      }
    );

    if (claimed) {
      await LeadActivity.create({
        lead: claimed._id,
        type: 'assigned',
        title: 'Lead automatically assigned',
        note: 'Counsellor claimed this unassigned lead by updating it.',
        counsellor: req.user._id,
        doneBy: req.user._id
      });
      return next();
    }

    if (await Lead.exists({ _id: req.params.id, assignedTo: counsellorId })) return next();
    return res.status(403).render('403', { title: 'Access Denied', user: req.user });
  } catch (err) {
    next(err);
  }
};

module.exports = { claimLead, visibleToCounsellor };
