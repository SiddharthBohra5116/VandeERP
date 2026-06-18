/**
 * Admin Security Dashboard Routes — Security Module 6
 * Mounted at /admin/security
 *
 * All routes require: protect + role('admin')
 *
 * Endpoints:
 *  GET  /admin/security/dashboard        — render real-time dashboard view
 *  GET  /admin/security/alerts           — paginated JSON alert feed
 *  POST /admin/security/blacklist        — deactivate user + revoke all their tokens
 *  POST /admin/security/unblacklist      — restore user (requires OTP confirmation)
 *  GET  /admin/security/otp/:userId      — generate 10-min restoration OTP
 */
const express       = require('express');
const crypto        = require('crypto');
const router        = express.Router();
const protect       = require('../../middleware/auth');
const role          = require('../../middleware/role');
const SecurityAlert = require('../../models/security/SecurityAlert');
const FeeAuditLog   = require('../../models/security/FeeAuditLog');
const TokenBlacklist = require('../../models/security/TokenBlacklist');
const User          = require('../../models/User');
const { createAlert } = require('../../middleware/security/index');
const { blacklistToken } = require('../../middleware/security/jwtSentinel');

// In-memory OTP store {userId: {otp, expiresAt}}
const otpStore = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compute current threat level based on alert count in last hour */
async function getThreatLevel() {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60_000);
    const count = await SecurityAlert.countDocuments({ createdAt: { $gte: oneHourAgo } });
    if      (count >= 21) return { level: 'CRITICAL', count };
    else if (count >= 6)  return { level: 'HIGH',     count };
    else if (count >= 1)  return { level: 'MEDIUM',   count };
    else                  return { level: 'LOW',       count };
  } catch (err) {
    return { level: 'UNKNOWN', count: 0 };
  }
}

/** Top N users by anomaly score in last 24h */
async function getTopFlaggedUsers(limit = 5) {
  try {
    return await SecurityAlert.aggregate([
      { $match: { userId: { $ne: null }, createdAt: { $gte: new Date(Date.now() - 86_400_000) } } },
      { $group: { _id: '$userId', totalScore: { $sum: '$anomalyScore' }, alertCount: { $sum: 1 } } },
      { $sort: { totalScore: -1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmpty: true } },
      { $project: { userId: '$_id', totalScore: 1, alertCount: 1, userName: '$user.name', userRole: '$user.role' } }
    ]);
  } catch (err) {
    return [];
  }
}

// All routes require admin auth
router.use(protect, role('admin'));

// ── GET /admin/security/dashboard ────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [recentAlerts, threat, flaggedUsers] = await Promise.all([
      SecurityAlert.find().sort({ createdAt: -1 }).limit(50).lean(),
      getThreatLevel(),
      getTopFlaggedUsers(5)
    ]);

    res.render('admin/securityDashboard', {
      layout:        'main',
      title:         'Security Dashboard',
      subtitle:      'Security — Real-Time Threat Monitor',
      page:          'security',
      recentAlerts,
      threat,
      flaggedUsers
    });
  } catch (err) {
    console.error('[Security/ASD] Dashboard error:', err);
    res.status(500).render('500', { title: 'Server Error', layout: 'main', errorDetail: err.message });
  }
});

// ── GET /admin/security/alerts (JSON API) ────────────────────────────────────
router.get('/alerts', async (req, res) => {
  try {
    const { type, userId, from, to, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (type)   filter.type   = type;
    if (userId) filter.userId = userId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const [alerts, total] = await Promise.all([
      SecurityAlert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      SecurityAlert.countDocuments(filter)
    ]);

    res.json({
      alerts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/security/blacklist ───────────────────────────────────────────
router.post('/blacklist', async (req, res) => {
  try {
    const { userId, reason } = req.body;
    if (!userId || !reason) {
      return res.status(400).json({ error: 'userId and reason are required.' });
    }

    const target = await User.findById(userId);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin') {
      return res.status(403).json({ error: 'Cannot blacklist another admin via this endpoint.' });
    }

    // Deactivate user
    await User.findByIdAndUpdate(userId, {
      isActive:              false,
      tokenBlacklistedBefore: new Date()  // invalidates ALL existing tokens
    });

    await createAlert({
      type:      'manual_blacklist',
      severity:  'HIGH',
      userId,
      endpoint:  req.path,
      details:   { reason, performedBy: req.user._id, performedByName: req.user.name }
    });

    // Notify all admin security clients in real time
    const io = req.app.get('io');
    if (io) {
      io.to('security').emit('security:alert', {
        type:      'manual_blacklist',
        severity:  'HIGH',
        userId,
        userName:  target.name,
        reason,
        timestamp: new Date()
      });
    }

    res.json({ success: true, message: `User ${target.name} has been deactivated and all tokens revoked.` });
  } catch (err) {
    console.error('[Security/ASD] Blacklist error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/security/otp/:userId — generate restoration OTP ───────────────
router.get('/otp/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const otp       = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60_000); // 10 minutes
    otpStore.set(userId, { otp, expiresAt });

    // In production you'd email this — for now return it in JSON (admin only)
    res.json({ otp, expiresAt, note: 'OTP valid for 10 minutes. Share securely.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/security/unblacklist ─────────────────────────────────────────
router.post('/unblacklist', async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ error: 'userId and otp are required.' });
    }

    const stored = otpStore.get(userId);
    if (!stored) {
      return res.status(400).json({ error: 'No OTP found for this user. Generate one first.' });
    }
    if (new Date() > stored.expiresAt) {
      otpStore.delete(userId);
      return res.status(400).json({ error: 'OTP has expired. Generate a new one.' });
    }
    if (stored.otp !== otp) {
      return res.status(403).json({ error: 'Invalid OTP.' });
    }

    // OTP valid — restore user
    otpStore.delete(userId);
    const target = await User.findByIdAndUpdate(userId,
      { isActive: true, tokenBlacklistedBefore: null },
      { new: true }
    );

    if (!target) return res.status(404).json({ error: 'User not found.' });

    await createAlert({
      type:      'manual_blacklist',
      severity:  'LOW',
      userId,
      endpoint:  req.path,
      details:   { action: 'unblacklist', performedBy: req.user._id }
    });

    res.json({ success: true, message: `User ${target.name} has been restored.` });
  } catch (err) {
    console.error('[Security/ASD] Unblacklist error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/security/fee-audit ────────────────────────────────────────────
router.get('/fee-audit', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      FeeAuditLog.find().sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit))
        .populate('studentId', 'name')
        .populate('requestedBy', 'name role')
        .lean(),
      FeeAuditLog.countDocuments()
    ]);
    res.json({ logs, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
