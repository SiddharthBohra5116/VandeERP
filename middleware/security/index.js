/**
 * AntiGravity Core — Shared Utilities
 *
 * Provides:
 *  1. isEnabled()        — reads ANTIGRAVITY_ENABLED env var
 *  2. createAlert(data)  — single entry point for all security event writes
 *  3. noopMiddleware     — used when AntiGravity is disabled
 *
 * WHY a single createAlert helper?
 *  Enforces consistent schema across all 6 modules. A missing field
 *  in one module doesn't silently corrupt the SecurityAlert collection.
 */
const SecurityAlert = require('../../models/security/SecurityAlert');

/**
 * Returns true if AntiGravity is enabled via environment variable.
 * Default: enabled. Set ANTIGRAVITY_ENABLED=false to disable all modules.
 */
function isEnabled() {
  return process.env.ANTIGRAVITY_ENABLED !== 'false';
}

/**
 * Write a security alert to MongoDB.
 * Fails-open: logs the error but never throws, so a DB outage never
 * crashes the security layer and thus never crashes the app.
 *
 * @param {Object} data
 * @param {string} data.type        - Alert type (enum from SecurityAlert model)
 * @param {string} data.severity    - 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
 * @param {ObjectId} [data.userId]  - Authenticated user ID if known
 * @param {string}  [data.ipAddress]
 * @param {string}  [data.endpoint]
 * @param {number}  [data.anomalyScore]
 * @param {Object}  [data.details]  - Free-form context object
 * @returns {Promise<Document|null>} The saved alert, or null on failure
 */
async function createAlert(data) {
  if (!isEnabled()) return null;
  try {
    const alert = new SecurityAlert({
      type:         data.type,
      severity:     data.severity   || 'LOW',
      userId:       data.userId     || null,
      ipAddress:    data.ipAddress  || null,
      endpoint:     data.endpoint   || null,
      anomalyScore: data.anomalyScore || 0,
      details:      data.details    || {}
    });
    return await alert.save();
  } catch (err) {
    console.error('[AntiGravity] createAlert failed (non-fatal):', err.message);
    return null;
  }
}

/**
 * A no-op middleware used when ANTIGRAVITY_ENABLED=false.
 * Every module returns this when disabled so the middleware chain
 * continues without any AntiGravity processing.
 */
function noopMiddleware(req, res, next) {
  next();
}

module.exports = { isEnabled, createAlert, noopMiddleware };
