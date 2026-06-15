/**
 * Behavioral Anomaly Engine (BAE) — AntiGravity Module 1
 *
 * Records every authenticated request to a rolling 24h log and asynchronously
 * computes an anomaly score (0–100) based on deviations from the user's
 * established behavior patterns.
 *
 * Anomaly scoring signals:
 *  +30  — new IP address (not seen in last 7 days for this user)
 *  +20  — request at unusual hour (outside user's typical active hours)
 *  +25  — privilege-sensitive endpoint accessed by unexpected role
 *  +25  — request rate > 3× user's 60-second rolling average
 *
 * WHY fail-open?
 *  BAE is observational and probabilistic. A false positive should never
 *  block a legitimate student from checking their fees or a teacher from
 *  marking attendance. The alert is raised and reviewed by an admin,
 *  not used to block the request.
 *
 * WHY async (setImmediate)?
 *  All anomaly calculations happen AFTER next() is called. The response
 *  is never delayed by anomaly scoring — scoring latency is invisible to users.
 */
const { isEnabled, createAlert, noopMiddleware } = require('./index');
const UserBehaviorLog = require('../../models/antiGravity/UserBehaviorLog');

// Endpoints that require specific roles — accessing them from the wrong role is suspicious
const SENSITIVE_PATHS = [
  { prefix: '/admin/',      expectedRole: 'admin'      },
  { prefix: '/teacher/',    expectedRole: 'teacher'    },
  { prefix: '/counsellor/', expectedRole: 'counsellor' },
  { prefix: '/student/',    expectedRole: 'student'    },
  { prefix: '/admin/fee',   expectedRole: 'admin'      }
];

/**
 * Compute anomaly score asynchronously for a given request.
 * Returns a number 0–100+. Scores ≥ 60 trigger a security alert.
 *
 * @param {Object} req        - Express request object (after protect runs, req.user is set)
 * @param {number} startTime  - Request start timestamp (ms)
 */
async function computeAnomalyScore(req, startTime) {
  const userId    = req.user._id;
  const userRole  = req.user.role;
  const userAgent = req.headers['user-agent'] || '';
  const ip        = req.ip;
  const endpoint  = req.path;
  const now       = new Date();
  const responseTime = Date.now() - startTime;

  // ── Record this request in the behavior log ─────────────────────────────
  try {
    await UserBehaviorLog.create({
      userId, role: userRole, endpoint,
      method:       req.method,
      ipAddress:    ip,
      userAgent,
      responseTime,
      timestamp:    now
    });
  } catch (err) {
    console.error('[AntiGravity/BAE] Log write failed (non-fatal):', err.message);
    return 0; // Can't score without logs
  }

  let score = 0;
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // ── Signal 1: New IP address (+30) ─────────────────────────────────────
  try {
    const knownIp = await UserBehaviorLog.exists({
      userId,
      ipAddress: ip,
      timestamp: { $gte: sevenDaysAgo }
    });
    if (!knownIp) score += 30;
  } catch (err) {
    console.error('[AntiGravity/BAE] IP check failed (non-fatal):', err.message);
  }

  // ── Signal 2: Unusual hour (+20) ────────────────────────────────────────
  try {
    const currentHour = now.getUTCHours();
    // Gather all hours the user was active in the last 7 days
    const recentLogs = await UserBehaviorLog.find(
      { userId, timestamp: { $gte: sevenDaysAgo } },
      { timestamp: 1 }
    ).lean();

    if (recentLogs.length >= 10) { // need enough data to establish a baseline
      const activeHours = new Set(recentLogs.map(l => new Date(l.timestamp).getUTCHours()));
      if (!activeHours.has(currentHour)) score += 20;
    }
    // If insufficient data, skip this signal (avoid false positives for new users)
  } catch (err) {
    console.error('[AntiGravity/BAE] Hour check failed (non-fatal):', err.message);
  }

  // ── Signal 3: Wrong role on sensitive path (+25) ─────────────────────────
  const isSensitivePath = SENSITIVE_PATHS.find(p => endpoint.startsWith(p.prefix));
  if (isSensitivePath && isSensitivePath.expectedRole !== userRole) {
    score += 25;
  }

  // ── Signal 4: Request rate > 3× average (+25) ────────────────────────────
  try {
    const sixtySecondsAgo = new Date(now - 60_000);

    // Count requests in the last 60 seconds for this user
    const recentCount = await UserBehaviorLog.countDocuments({
      userId,
      timestamp: { $gte: sixtySecondsAgo }
    });

    // Compute 7-day average rate (requests per 60-second window)
    const totalCount7d  = await UserBehaviorLog.countDocuments({
      userId,
      timestamp: { $gte: sevenDaysAgo }
    });
    const avgPer60s = totalCount7d > 0 ? totalCount7d / (7 * 24 * 60) : 0;

    if (avgPer60s > 0 && recentCount > avgPer60s * 3) {
      score += 25;
    }
  } catch (err) {
    console.error('[AntiGravity/BAE] Rate check failed (non-fatal):', err.message);
  }

  return score;
}

/**
 * Express middleware — records the request and asynchronously computes anomaly score.
 * Calls next() IMMEDIATELY. All scoring happens in the background.
 */
async function behaviorEngine(req, res, next) {
  // Only run for authenticated users
  if (!req.user) return next();

  const startTime = Date.now();

  // Call next() first — user experience is never delayed by anomaly scoring
  next();

  // Score async after response is on its way
  setImmediate(async () => {
    try {
      const score = await computeAnomalyScore(req, startTime);

      if (score >= 60) {
        const severity = score >= 80 ? 'CRITICAL' : score >= 70 ? 'HIGH' : 'MEDIUM';

        const alert = await createAlert({
          type:         'anomaly',
          severity,
          userId:       req.user._id,
          ipAddress:    req.ip,
          endpoint:     req.path,
          anomalyScore: score,
          details: {
            role:      req.user.role,
            method:    req.method,
            userAgent: req.headers['user-agent'] || ''
          }
        });

        // Emit real-time Socket.IO event to admin security namespace
        const io = req.app?.get('io');
        if (io && alert) {
          io.to('security').emit('security:alert', {
            alertId:      alert._id,
            type:         'anomaly',
            severity,
            userId:       req.user._id,
            userName:     req.user.name,
            anomalyScore: score,
            endpoint:     req.path,
            ip:           req.ip,
            timestamp:    new Date()
          });

          // Update threat level if needed
          const recentCount = await alert.constructor.countDocuments({
            createdAt: { $gte: new Date(Date.now() - 60 * 60_000) }
          });
          const newLevel = recentCount >= 21 ? 'CRITICAL' : recentCount >= 6 ? 'HIGH' : recentCount >= 1 ? 'MEDIUM' : 'LOW';
          io.to('security').emit('security:threat_level_change', { level: newLevel, alertCount: recentCount });
        }
      }
    } catch (err) {
      // Fail-open: anomaly scoring error never affects the app
      console.error('[AntiGravity/BAE] Scoring error (non-fatal):', err.message);
    }
  });
}

module.exports = isEnabled() ? behaviorEngine : noopMiddleware;
