/**
 * UserBehaviorLog Model — AntiGravity Module 1 (BAE)
 * Capped at 10,000 documents. 24h TTL auto-removes old entries.
 * Lightweight footprint for rolling anomaly detection window.
 */
const mongoose = require('mongoose');

const userBehaviorLogSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  role:         { type: String },
  endpoint:     { type: String },
  method:       { type: String },
  ipAddress:    { type: String },
  userAgent:    { type: String },
  responseTime: { type: Number },  // ms
  timestamp:    { type: Date, default: Date.now, index: { expireAfterSeconds: 86400 } }
});

module.exports = mongoose.model('UserBehaviorLog', userBehaviorLogSchema);
