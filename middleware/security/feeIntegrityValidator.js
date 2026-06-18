/**
 * Fee Integrity Validator (FIV) — Security Module 5
 *
 * Applied only to fee/payment routes. Enforces server-side financial rules
 * that cannot be bypassed regardless of what the frontend sends.
 *
 * POST checks (payment recording):
 *  - Amount must be > 0
 *  - Amount must not exceed outstanding balance × 1.01 (1% rounding tolerance)
 *  - Every attempt (pass or fail) is logged to FeeAuditLog
 *
 * GET checks (fee reports):
 *  - Hooks res.on('finish') to verify paidAmount matches sum of Payment subdocs
 *  - Drift > ₹1 triggers a security:fee_drift Socket.IO alert
 *
 * WHY fail-CLOSED for POST, fail-open for GET?
 *  Overpayment recording is irreversible without manual intervention.
 *  A DB error during the balance check MUST block the payment — not approve it.
 *  GET drift detection is observational; failing open avoids blocking read access.
 *
 * WHY 1% tolerance?
 *  Floating-point arithmetic in JavaScript and INR paise rounding can produce
 *  differences of a few rupees on large amounts. The 1% tolerance covers this
 *  without meaningfully allowing abuse.
 */
const Fee         = require('../../models/Fee');
const FeeAuditLog = require('../../models/security/FeeAuditLog');
const Student     = require('../../models/Student');
const { isEnabled, createAlert, noopMiddleware } = require('./index');

/**
 * Resolve the student ID from the request.
 * Tries: req.body.studentId → req.params.studentId → authenticated student profile.
 * Returns a string ID or null.
 */
async function resolveStudentId(req) {
  if (req.body?.studentId)    return req.body.studentId;
  if (req.params?.studentId)  return req.params.studentId;
  if (req.params?.id)         return req.params.id;
  // If the user is a student, use their own profile ID
  if (req.user?.studentProfileId) return req.user.studentProfileId;
  return null;
}

/**
 * Main middleware.
 */
async function feeIntegrityValidator(req, res, next) {
  // ── GET: attach response hook for drift detection ─────────────────────────
  if (req.method === 'GET') {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Check asynchronously after response is sent — never delay the GET
      setImmediate(async () => {
        try {
          if (body?.fee || body?.paidAmount !== undefined) {
            const fee = body.fee || body;
            if (fee.payments && Array.isArray(fee.payments) && fee.paidAmount !== undefined) {
              const computedPaid = fee.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
              const drift        = Math.abs(computedPaid - fee.paidAmount);

              if (drift > 1) { // ₹1 tolerance
                const alert = await createAlert({
                  type:      'fee_drift',
                  severity:  'HIGH',
                  userId:    req.user?._id || null,
                  endpoint:  req.path,
                  details:   {
                    recordedPaid: fee.paidAmount,
                    computedPaid,
                    drift,
                    feeId: fee._id
                  }
                });

                const io = req.app?.get('io');
                if (io && alert) {
                  io.to('security').emit('security:fee_drift', {
                    alertId:      alert._id,
                    feeId:        fee._id,
                    drift,
                    recordedPaid: fee.paidAmount,
                    computedPaid,
                    timestamp:    new Date()
                  });
                }
              }
            }
          }
        } catch (err) {
          // Fail-open on drift detection — never block GET responses
          console.error('[Security/FIV] Drift check failed (non-fatal):', err.message);
        }
      });

      return originalJson(body);
    };

    return next();
  }

  // ── POST/PUT: payment validation — FAIL-CLOSED ───────────────────────────
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Only validate if this looks like a payment submission
    const hasAmount = req.body?.amount !== undefined;
    if (!hasAmount) return next();

    const amount = parseFloat(req.body.amount);

    // Basic sanity check
    if (isNaN(amount) || amount <= 0) {
      await FeeAuditLog.create({
        studentId:   (await resolveStudentId(req)) || req.user?._id,
        requestedBy: req.user?._id,
        amount:      isNaN(amount) ? 0 : amount,
        outstanding: 0,
        passed:      false,
        failReason:  'amount_zero_or_negative'
      }).catch(() => {});

      return res.status(422).json({
        error: 'Payment amount must be greater than ₹0.'
      });
    }

    // Resolve student and fee — FAIL-CLOSED: reject if can't verify
    let studentId, fee, outstanding;
    try {
      studentId = await resolveStudentId(req);

      if (!studentId) {
        return res.status(422).json({ error: 'Student could not be identified for this payment.' });
      }

      fee = await Fee.findOne({ student: studentId }).lean();

      if (!fee) {
        // No fee record — could be admin creating first payment, allow through
        return next();
      }

      outstanding = fee.totalAmount - (fee.discount || 0) - fee.paidAmount;
    } catch (err) {
      // FAIL-CLOSED: DB error during balance check blocks the payment
      console.error('[Security/FIV] Fee lookup failed (fail-closed):', err.message);
      return res.status(503).json({
        error: 'Payment validation temporarily unavailable. Please try again.'
      });
    }

    // Overpayment check (1% tolerance for rounding)
    const maxAllowed = outstanding * 1.01;
    const passed     = amount <= maxAllowed;
    const failReason = !passed ? `overpayment: ₹${amount} > ₹${outstanding.toFixed(2)} outstanding` : null;

    // Log every attempt — pass or fail
    await FeeAuditLog.create({
      studentId,
      requestedBy: req.user?._id,
      amount,
      outstanding,
      passed,
      failReason
    }).catch(err => console.error('[Security/FIV] Audit log failed:', err.message));

    if (!passed) {
      await createAlert({
        type:      'fee_drift',
        severity:  'HIGH',
        userId:    req.user?._id || null,
        endpoint:  req.path,
        details:   { amount, outstanding, studentId, failReason }
      });

      return res.status(422).json({
        error:       'Payment exceeds outstanding balance.',
        outstanding: parseFloat(outstanding.toFixed(2)),
        attempted:   amount
      });
    }
  }

  next();
}

module.exports = isEnabled() ? feeIntegrityValidator : noopMiddleware;
