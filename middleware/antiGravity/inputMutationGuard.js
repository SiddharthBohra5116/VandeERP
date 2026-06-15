/**
 * Input Mutation Guard (IMG) — AntiGravity Module 4
 *
 * Applied AFTER body-parsing middleware (express.json / urlencoded).
 * Sanitizes req.body, req.query, and req.params before any controller sees them.
 *
 * Protections applied in order:
 *  a) NoSQL injection — strips keys starting with '$' or containing '.'
 *  b) XSS sanitization — removes <script>, <iframe>, javascript:, and on* event attrs
 *  c) Mass-assignment guard — strips privileged fields from auth/admin/counsellor routes
 *  d) Field overflow — truncates strings exceeding MAX_FIELD_LENGTH to prevent DoS
 *
 * WHY fail-open here?
 *  The guard is a defence-in-depth layer. If it crashes, the app should keep running
 *  (other sanitization like express-mongo-sanitize is still active). A broken IMG
 *  should not take down student fee payments or attendance records.
 *
 * WHY after body parser?
 *  req.body does not exist before express.json() / urlencoded() runs. Placing IMG
 *  before body parsing would mean it has nothing to sanitize.
 */
const crypto = require('crypto');
const { isEnabled, createAlert, noopMiddleware } = require('./index');

const MAX_FIELD_LENGTH = 5000;

// Fields that must NEVER be accepted from end-user request bodies.
// Stricter routes (auth/admin/counsellor) strip all of these.
const MASS_ASSIGN_BLOCKED_FIELDS = [
  'role', 'isActive', 'status', 'fees_total', 'fees_paid',
  'createdAt', 'updatedAt', '__v', 'password', 'tokenBlacklistedBefore',
  'passwordChangedAt'
];

// Routes where mass-assignment protection is applied
const SENSITIVE_ROUTE_PREFIXES = ['/auth/', '/admin/users', '/counsellor/', '/admin/security'];

/**
 * Recursively strip MongoDB operator keys ($ prefix or . in key name).
 * Mutates the object in-place. Returns list of removed keys for logging.
 * SECURITY: Prevents NoSQL injection like { "name": { "$gt": "" } }
 */
function stripNoSQLInjection(obj, removed = []) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return removed;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      removed.push(key);
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      stripNoSQLInjection(obj[key], removed);
    }
  }
  return removed;
}

/**
 * Recursively sanitize string values: strip XSS patterns.
 * Does NOT HTML-encode (EJS <%= %> handles that) — removes the attack vector entirely.
 */
function stripXSS(val) {
  if (typeof val !== 'string') return val;
  return val
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')   // onclick="..." onload='...'
    .replace(/\bon\w+\s*=\s*[^\s>]*/gi, '');          // onclick=alert(1)
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = stripXSS(obj[key]);
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key]);
    }
  }
  return obj;
}

/**
 * Truncate oversized string fields and return a list of overflowed field names.
 */
function truncateOverflowFields(obj, path = '', overflowed = []) {
  if (!obj || typeof obj !== 'object') return overflowed;
  for (const key of Object.keys(obj)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (typeof obj[key] === 'string' && obj[key].length > MAX_FIELD_LENGTH) {
      overflowed.push({ field: fieldPath, originalLength: obj[key].length });
      obj[key] = obj[key].slice(0, MAX_FIELD_LENGTH);
    } else if (typeof obj[key] === 'object') {
      truncateOverflowFields(obj[key], fieldPath, overflowed);
    }
  }
  return overflowed;
}

/**
 * Strip mass-assignment fields from request body for sensitive routes.
 */
function stripMassAssignmentFields(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const field of MASS_ASSIGN_BLOCKED_FIELDS) {
    if (field in obj) {
      delete obj[field];
    }
  }
}

/**
 * SHA-256 hash of a value — logged instead of the raw value to avoid
 * storing potentially malicious content in security logs.
 */
function hashValue(val) {
  return crypto.createHash('sha256').update(String(val)).digest('hex').slice(0, 16);
}

/**
 * Main middleware function.
 */
async function inputMutationGuard(req, res, next) {
  // Always call next immediately — guard is async defence-in-depth
  // (but we apply synchronous sanitizations before next() here)
  try {
    const mutations = [];
    const isSensitiveRoute = SENSITIVE_ROUTE_PREFIXES.some(p => req.path.startsWith(p));

    // --- a) NoSQL injection stripping ---
    const injectionHits = [
      ...stripNoSQLInjection(req.body  || {}),
      ...stripNoSQLInjection(req.query || {}),
      ...stripNoSQLInjection(req.params || {})
    ];
    if (injectionHits.length > 0) {
      mutations.push({ type: 'nosql_injection', keys: injectionHits });
    }

    // --- b) XSS sanitization ---
    sanitizeObject(req.body);
    sanitizeObject(req.query);

    // --- c) Mass-assignment protection (sensitive routes only) ---
    if (isSensitiveRoute && req.body) {
      stripMassAssignmentFields(req.body);
    }

    // --- d) Field overflow truncation ---
    const overflowedBody   = truncateOverflowFields(req.body  || {});
    const overflowedQuery  = truncateOverflowFields(req.query || {});
    if (overflowedBody.length > 0 || overflowedQuery.length > 0) {
      mutations.push({ type: 'field_overflow', fields: [...overflowedBody, ...overflowedQuery] });
    }

    // --- Log any mutations async (fail-open — never block the request) ---
    if (mutations.length > 0) {
      setImmediate(async () => {
        try {
          for (const mut of mutations) {
            await createAlert({
              type:      mut.type === 'nosql_injection' ? 'input_mutation' : 'field_overflow',
              severity:  mut.type === 'nosql_injection' ? 'HIGH' : 'MEDIUM',
              userId:    req.user?._id || null,
              ipAddress: req.ip,
              endpoint:  req.path,
              details:   {
                mutationType: mut.type,
                keys: mut.keys || mut.fields?.map(f => f.field) || [],
                bodyHash: hashValue(JSON.stringify(req.body || {}))
              }
            });
          }
        } catch (err) {
          console.error('[AntiGravity/IMG] Alert write failed (non-fatal):', err.message);
        }
      });
    }
  } catch (err) {
    // Fail-open: sanitization error must never block legitimate requests
    console.error('[AntiGravity/IMG] Guard error (non-fatal, passing through):', err.message);
  }

  next();
}

module.exports = isEnabled() ? inputMutationGuard : noopMiddleware;
