const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const role = require('../middleware/role');
const ctrl = require('../controllers/counsellorController');
const leadImportCtrl = require('../controllers/admin/leadController');
const upload = require('../utils/uploadHelper');
const csrfProtection = require('../middleware/security/csrfProtection');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const Student = require('../models/Student');
const { getClosedLeadStatusKeys } = require('../utils/leadStatusOptions');

const populateCounsellorSidebar = async (req, res, next) => {
  if (req.user && req.user.role === 'counsellor') {
    try {
      const today = new Date();
      today.setHours(0,0,0,0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const closedStatuses = await getClosedLeadStatusKeys();
      const [leadCount, followupCount, studentCount] = await Promise.all([
        Lead.countDocuments({ assignedTo: req.user.counsellorProfileId }),
        Lead.countDocuments({
          assignedTo: req.user.counsellorProfileId,
          nextFollowUpAt: { $lt: tomorrow },
          status: { $nin: closedStatuses }
        }),
        Student.countDocuments({ counsellor: req.user.counsellorProfileId })
      ]);
      res.locals.leadCount = leadCount;
      res.locals.followupCount = followupCount;
      res.locals.studentCount = studentCount;
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
router.post(
  '/leads/import',
  ...guard,
  (req, res, next) => upload.single('leadCsv')(req, res, err => {
    if (err) return res.redirect(`/counsellor/leads?error=${encodeURIComponent(err.message)}`);
    next();
  }),
  csrfProtection,
  leadImportCtrl.postImportLeads
);
router.get('/leads/followups', ...guard, ctrl.getFollowUps);
router.post('/leads/walkin', ...guard, leadValidator, ctrl.postWalkIn);
router.get('/students', ...guard, ctrl.getMyStudents);
router.get('/admissions', ...guard, ctrl.getAdmissions);
router.get('/admissions/:id/fee', ...guard, ctrl.getStudentFee);

router.get('/leads/:id', ...guard, ctrl.getLeadDetail);
router.get('/leads/:id/edit', ...guard, ctrl.getEditLead);
router.get('/leads/:id/convert', ...guard, ctrl.getConvertLead);
router.post('/leads/:id/convert', ...guard, ctrl.postConvertLead);
router.post('/leads/:id/edit', ...guard, leadValidator, ctrl.postEditLead);
router.post('/leads/:id/followup', ...guard, ctrl.postAddFollowUp);
router.post('/leads/:id/followup/:index/edit', ...guard, ctrl.postEditFollowUp);
router.post('/leads/:id/lost', ...guard, ctrl.postMarkLost);
router.post('/leads/:id/ready', ...guard, ctrl.postMarkReady);

// Messaging
router.post('/messages/send', ...guard, ctrl.postSendMessage);
router.post('/messages/:id/read', ...guard, async (req, res) => {
  await Message.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ ok: true });
});

// Leave Requests
router.get('/leaves', ...guard, ctrl.getLeavesPage);
router.post('/leaves/apply', ...guard, ctrl.postApplyLeave);

// Reports & Analytics
router.get('/reports', ...guard, ctrl.getReports);

// Announcements
router.get('/announcements', ...guard, ctrl.getCounsellorAnnouncements);
router.get('/announcements/create', ...guard, ctrl.getCounsellorCreateAnnouncement);
router.post('/announcements/create', ...guard, ctrl.postCounsellorCreateAnnouncement);
router.post('/announcements/:id/toggle', ...guard, ctrl.postCounsellorToggleAnnouncement);

module.exports = router;
