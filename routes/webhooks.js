const express = require('express');
const router = express.Router();

const { createAutomatedLead } = require('../utils/leadAutomation');
const logger = require('../utils/logger');

function verifyLeadWebhook(req, res, next) {
  const expected = process.env.LEAD_WEBHOOK_SECRET;
  if (!expected) {
    return res.status(503).json({
      ok: false,
      error: 'Lead webhook is not configured.'
    });
  }

  const supplied = req.get('x-lead-webhook-secret') || req.query.secret;
  if (supplied !== expected) {
    return res.status(401).json({
      ok: false,
      error: 'Invalid webhook secret.'
    });
  }

  next();
}

router.post('/leads', verifyLeadWebhook, async (req, res) => {
  try {
    const result = await createAutomatedLead(req.body || {});

    if (result.duplicate) {
      return res.status(200).json({
        ok: true,
        duplicate: true,
        leadId: result.lead._id,
        message: 'Lead already exists.'
      });
    }

    res.status(201).json({
      ok: true,
      duplicate: false,
      leadId: result.lead._id,
      assignedTo: result.assignedCounsellor?.user?.name || null,
      followUpAt: result.lead.nextFollowUpAt
    });
  } catch (err) {
    logger.error('Automated lead webhook failed', {
      err: err.message,
      stack: err.stack
    });

    res.status(400).json({
      ok: false,
      error: err.message
    });
  }
});

module.exports = router;
