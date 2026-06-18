/**
 * UserBehaviorLog Model — Security Module 1 (BAE)
 * 7-day TTL auto-removes old entries.
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
  timestamp:    { type: Date, default: Date.now, index: { expireAfterSeconds: 604800 } } // 7 days
});

module.exports = mongoose.model('UserBehaviorLog', userBehaviorLogSchema);
