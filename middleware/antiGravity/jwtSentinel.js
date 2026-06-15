/**
 * JWT Sentinel — AntiGravity Module 3
 *
 * Wraps the existing protect middleware with two additional layers:
 *  1. Per-token blacklist check (TokenBlacklist collection)
 *  2. User-level invalidation via tokenBlacklistedBefore timestamp
 *     (covers "revoke all tokens for this user" without storing every token)
 *  3. Token age enforcement (force re-login after 7 days)
 *  4. Password-change freshness (rejects tokens issued before passwordChangedAt)
 *
 * WHY fail-CLOSED on blacklist/DB errors?
 *  Unlike logging modules (which fail-open to avoid breaking the app),
 *  the JWT blacklist is a security-critical gate. If we can't check whether
 *  a token is revoked, we must assume it might be and reject it — otherwise
 *  a DB blip becomes a security bypass window.
 *
 * NOTE on "revoke all tokens for user":
 *  JWTs are stateless — you cannot enumerate "all active tokens" without storing
 *  them all. Instead, we store a single timestamp (tokenBlacklistedBefore) on the
 *  User document. Any token with iat (issued-at) before that timestamp is rejected.
 *  This is equivalent to revoking all previously issued tokens with one DB write.
 *
 * Exports:
 *  - default export: jwtSentinel(protect) — wrapped middleware
 *  - blacklistToken(token, reason, expiresAt) — callable by other modules
 */
const jwt            = require('jsonwebtoken');
const TokenBlacklist = require('../../models/antiGravity/TokenBlacklist');
const { isEnabled, createAlert } = require('./index');

/**
 * Explicitly add a single JWT to the blacklist.
 * Used when a specific token is known-compromised (e.g. suspicious IP switch).
 *
 * @param {string} token      - The raw JWT string
 * @param {string} reason     - Human-readable reason for blacklisting
 * @param {Date}   expiresAt  - When the token would naturally expire (for TTL cleanup)
 */
async function blacklistToken(token, reason, expiresAt) {
  try {
    await TokenBlacklist.create({ token, reason, expiresAt });
  } catch (err) {
    // Duplicate key = already blacklisted, that's fine
    if (err.code !== 11000) {
      console.error('[AntiGravity/Sentinel] blacklistToken error:', err.message);
    }
  }
}

/**
 * Extract the raw token string from the request (cookie or Authorization header).
 * Returns null if no token found.
 */
function extractToken(req) {
  if (req.cookies?.token) return req.cookies.token;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.split(' ')[1];
  return null;
}

/**
 * Force re-login by clearing cookie and redirecting/responding 401.
 */
function forceReLogin(req, res, reason) {
  res.clearCookie('token');
  if (req.accepts('html')) {
    return res.redirect('/auth/login?error=session_expired');
  }
  return res.status(401).json({ message: reason });
}

/**
 * jwtSentinel wraps the existing protect middleware.
 * Returns a new middleware function that runs sentinel checks BEFORE protect.
 *
 * @param {Function} protect - The original auth.js protect middleware
 * @returns {Function} Enhanced protect middleware
 */
function jwtSentinel(protect) {
  if (!isEnabled()) return protect;

  return async function sentinelProtect(req, res, next) {
    const token = extractToken(req);

    if (!token) {
      // No token → let original protect handle it (redirect to login)
      return protect(req, res, next);
    }

    // ── 1. Per-token blacklist check ───────────────────────────────────────
    // FAIL-CLOSED: if DB check throws, reject the request.
    try {
      const blacklisted = await TokenBlacklist.findOne({ token }).lean();
      if (blacklisted) {
        await createAlert({
          type:     'token_anomaly',
          severity: 'HIGH',
          ipAddress: req.ip,
          endpoint:  req.path,
          details:   { reason: 'blacklisted_token', blacklistReason: blacklisted.reason }
        });
        return forceReLogin(req, res, 'Session has been revoked');
      }
    } catch (err) {
      console.error('[AntiGravity/Sentinel] Blacklist DB check failed (fail-closed):', err.message);
      return forceReLogin(req, res, 'Session validation unavailable');
    }

    // ── Decode token (without verify — we just need the payload for pre-checks) ──
    let decoded;
    try {
      // Note: we ONLY use the secret here (no fallback). If JWT_SECRET is missing
      // the server already exits at startup (server.js line 7-10).
      decoded = jwt.decode(token);
    } catch (err) {
      return forceReLogin(req, res, 'Invalid session token');
    }

    if (!decoded) {
      return forceReLogin(req, res, 'Invalid session token');
    }

    // ── 2. Token age enforcement (>7 days → force re-login) ────────────────
    const tokenAgeMs = Date.now() - (decoded.iat * 1000);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (tokenAgeMs > sevenDaysMs) {
      await blacklistToken(token, 'token_age_expired', new Date(decoded.exp * 1000)).catch(() => {});
      return forceReLogin(req, res, 'Session expired, please log in again');
    }

    // ── 3. User-level token invalidation (tokenBlacklistedBefore) ──────────
    // This check runs inside protect (after user is loaded), so we augment next()
    // to perform the check post-user-load.
    // We pass control to the original protect and intercept with a patched next.
    const originalNext = next;
    const patchedNext = async (err) => {
      if (err) return originalNext(err);

      // At this point protect has loaded req.user
      if (!req.user) return originalNext();

      try {
        // Reload user with sentinel fields (protect uses .select('-password'))
        const User = require('../../models/User');
        const user = await User.findById(req.user._id).select('tokenBlacklistedBefore passwordChangedAt').lean();

        if (user) {
          const tokenIssuedAt = decoded.iat * 1000;

          // 3a. User-level bulk revocation
          if (user.tokenBlacklistedBefore && tokenIssuedAt < user.tokenBlacklistedBefore.getTime()) {
            await createAlert({
              type:     'token_anomaly',
              severity: 'HIGH',
              userId:    req.user._id,
              ipAddress: req.ip,
              endpoint:  req.path,
              details:   { reason: 'user_token_revoked' }
            }).catch(() => {});
            return forceReLogin(req, res, 'Session revoked by administrator');
          }

          // 3b. Password change freshness
          if (user.passwordChangedAt && tokenIssuedAt < user.passwordChangedAt.getTime()) {
            await blacklistToken(token, 'password_changed', new Date(decoded.exp * 1000)).catch(() => {});
            await createAlert({
              type:     'token_anomaly',
              severity: 'MEDIUM',
              userId:    req.user._id,
              ipAddress: req.ip,
              endpoint:  req.path,
              details:   { reason: 'token_predates_password_change' }
            }).catch(() => {});
            return forceReLogin(req, res, 'Password changed — please log in again');
          }
        }
      } catch (err) {
        // FAIL-CLOSED on user sentinel checks
        console.error('[AntiGravity/Sentinel] User check failed (fail-closed):', err.message);
        return forceReLogin(req, res, 'Session validation failed');
      }

      return originalNext();
    };

    return protect(req, res, patchedNext);
  };
}

module.exports = { jwtSentinel, blacklistToken };
