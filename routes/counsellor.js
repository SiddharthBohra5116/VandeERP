const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/counsellorController');
const Lead = require('../models/Lead');
const Message = require('../models/Message');

const populateCounsellorSidebar = async (req, res, next) => {
  if (req.user && req.user.role === 'counsellor') {
    try {
      const today = new Date();
      today.setHours(0,0,0,0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [leadCount, followupCount] = await Promise.all([
        Lead.countDocuments({ assignedTo: req.user._id }),
        Lead.countDocuments({
          assignedTo: req.user._id,
          followUpDate: { $lt: tomorrow },
          status: { $nin: ['converted', 'lost'] }
        })
      ]);
      res.locals.leadCount = leadCount;
      res.locals.followupCount = followupCount;
    } catch (err) {
      console.error('❌ Error populating counsellor sidebar counts:', err);
    }
  }
  next();
};

const guard = [protect, role('counsellor', 'admin'), populateCounsellorSidebar];

const { leadValidator } = require('../middleware/validators');

router.get('/dashboard', ...guard, ctrl.getDashboard);
router.get('/leads', ...guard, ctrl.getLeads);
router.get('/leads/create', ...guard, ctrl.getCreateLead);
router.get('/leads/new', ...guard, ctrl.getCreateLead); // alias for layout links
router.post('/leads/create', ...guard, leadValidator, ctrl.postCreateLead);
router.get('/leads/followups', ...guard, ctrl.getFollowUps);
router.post('/leads/walkin', ...guard, ctrl.postWalkIn);
router.get('/admissions', ...guard, ctrl.getAdmissions);
router.get('/admissions/:id/fee', ...guard, ctrl.getStudentFee);

router.get('/leads/:id', ...guard, ctrl.getLeadDetail);
router.get('/leads/:id/convert', ...guard, ctrl.getConvertLead);
router.post('/leads/:id/convert', ...guard, ctrl.postConvertLead);
router.post('/leads/:id/edit', ...guard, ctrl.postEditLead);
router.post('/leads/:id/followup', ...guard, ctrl.postAddFollowUp);
router.post('/leads/:id/lost', ...guard, ctrl.postMarkLost);
router.post('/leads/:id/ready', ...guard, ctrl.postMarkReady);
router.delete('/leads/:id', ...guard, ctrl.deleteLead);

// Messaging
router.post('/messages/send', ...guard, ctrl.postSendMessage);
router.post('/messages/:id/read', ...guard, async (req, res) => {
  await Message.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ ok: true });
});
module.exports = router;