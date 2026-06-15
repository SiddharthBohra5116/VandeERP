/**
 * Intelligent Rate Limiter (IRL) — AntiGravity Module 2
 *
 * Dynamic, per-role rate limits that tighten automatically under attack conditions.
 * Uses lru-cache as an in-memory store (no Redis needed for single-server deployment).
 *
 * WHY dynamic limits?
 *  A static rate limit gives attackers a known ceiling to work within.
 *  When security alerts spike (active attack), limits automatically halve or quarter,
 *  making sustained attacks far more expensive.
 *
 * WHY fail-closed on rate limit hit (unlike other modules)?
 *  A rate limit breach is a concrete, measurable event — not a probabilistic score.
 *  Failing open on a confirmed breach defeats the purpose of rate limiting.
 */
const rateLimit   = require('express-rate-limit');
const { LRUCache } = require('lru-cache');
const { isEnabled, createAlert, noopMiddleware } = require('./index');
const SecurityAlert = require('../../models/security/SecurityAlert');

// ── Base limits per role ─────────────────────────────────────────────────────
const BASE_LIMITS = {
  admin:      { windowMs: 60_000, max: 300 },
  teacher:    { windowMs: 60_000, max: 200 },
  counsellor: { windowMs: 60_000, max: 200 },
  student:    { windowMs: 60_000, max: 100 },
  anonymous:  { windowMs: 60_000, max: 20  }
};

// In-memory request counter store. TTL = 1 minute (matches the window).
const counterStore = new LRUCache({ max: 10_000, ttl: 60_000 });

// Cache the threat multiplier for 30 seconds to avoid hammering the DB
// on every request during an attack.
let cachedMultiplier   = 1;
let multiplierFetchedAt = 0;

/**
 * Query SecurityAlert for alert count in the last 5 minutes.
 * Returns a divisor: 1 (normal), 2 (elevated), or 4 (critical).
 * Fails-open: returns 1 (no tightening) if DB is unavailable.
 */
async function getThreatMultiplier() {
  const now = Date.now();
  if (now - multiplierFetchedAt < 30_000) return cachedMultiplier; // cached

  try {
    const fiveMinutesAgo = new Date(now - 5 * 60_000);
    const recentAlerts   = await SecurityAlert.countDocuments({ createdAt: { $gte: fiveMinutesAgo } });

    if      (recentAlerts > 20) cachedMultiplier = 4;
    else if (recentAlerts > 5)  cachedMultiplier = 2;
    else                        cachedMultiplier = 1;

    multiplierFetchedAt = now;
    return cachedMultiplier;
  } catch (err) {
    console.error('[AntiGravity/IRL] Multiplier fetch failed (non-fatal):', err.message);
    return 1; // fail-open: don't tighten on DB error
  }
}

/**
 * Custom store adapter for express-rate-limit using lru-cache.
 * express-rate-limit v7+ uses a store interface: increment / decrement / resetKey.
 */
class LRUStore {
  constructor() {
    this.prefix = 'ag:rl:';
  }

  async increment(key) {
    const fullKey = this.prefix + key;
    const current = counterStore.get(fullKey) || { count: 0, resetTime: new Date(Date.now() + 60_000) };
    current.count += 1;
    counterStore.set(fullKey, current);
    return { totalHits: current.count, resetTime: current.resetTime };
  }

  async decrement(key) {
    const fullKey = this.prefix + key;
    const current = counterStore.get(fullKey);
    if (current && current.count > 0) {
      current.count -= 1;
      counterStore.set(fullKey, current);
    }
  }

  async resetKey(key) {
    counterStore.delete(this.prefix + key);
  }
}

const lruStore = new LRUStore();

/**
 * Factory: returns a configured express-rate-limit middleware for the given role.
 * The max is computed dynamically on each call using the cached threat multiplier.
 *
 * @param {string} role - 'admin' | 'teacher' | 'counsellor' | 'student' | 'anonymous'
 * @returns {Function} Express middleware
 */
function getRateLimiter(role) {
  if (!isEnabled()) return noopMiddleware;

  const base = BASE_LIMITS[role] || BASE_LIMITS.anonymous;

  return rateLimit({
    windowMs: base.windowMs,
    store:    lruStore,

    // Dynamic max — recomputed per request via async handler
    max: async (req) => {
      const multiplier = await getThreatMultiplier();
      return Math.max(5, Math.floor(base.max / multiplier)); // floor of 5 to avoid 0
    },

    keyGenerator: (req) => {
      // Key: role:ip — keeps different roles isolated even from same IP
      return `${role}:${req.ip}`;
    },

    handler: async (req, res) => {
      // Fail-closed: log the breach and return 429
      try {
        const alert = await createAlert({
          type:      'rate_limit_breach',
          severity:  'HIGH',
          userId:    req.user?._id || null,
          ipAddress: req.ip,
          endpoint:  req.path,
          details:   { role, method: req.method }
        });

        // Emit Socket.IO event if io is available
        const io = req.app.get('io');
        if (io && alert) {
          io.to('security').emit('security:rate_limit_breach', {
            alertId:   alert._id,
            ip:        req.ip,
            role,
            endpoint:  req.path,
            timestamp: new Date()
          });
        }
      } catch (err) {
        console.error('[AntiGravity/IRL] Handler alert failed:', err.message);
      }

      const retryAfter = Math.ceil(base.windowMs / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        error:      'Too many requests. Please slow down.',
        retryAfter: `${retryAfter} seconds`
      });
    },

    skipSuccessfulRequests: false,
    standardHeaders: true,
    legacyHeaders:   false
  });
}

module.exports = { getRateLimiter };
