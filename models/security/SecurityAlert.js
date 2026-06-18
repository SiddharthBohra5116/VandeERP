/**
 * SecurityAlert Model — Security
 * Central event log. 7-day auto-expiry via MongoDB TTL index.
 * Always write via createAlert() helper, never directly.
 */
const mongoose = require('mongoose');

const securityAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['anomaly','rate_limit_breach','input_mutation','fee_drift','manual_blacklist','token_anomaly','field_overflow'],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['LOW','MEDIUM','HIGH','CRITICAL'],
    required: true
  },
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',    default: null, index: true },
  ipAddress:    { type: String, default: null },
  endpoint:     { type: String, default: null },
  anomalyScore: { type: Number, default: 0 },
  details:      { type: mongoose.Schema.Types.Mixed, default: {} },
  resolvedAt:   { type: Date, default: null },
  resolvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt:    { type: Date, default: Date.now, index: { expireAfterSeconds: 604800 } }
});

module.exports = mongoose.model('SecurityAlert', securityAlertSchema);
