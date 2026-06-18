/**
 * FeeAuditLog Model — Security Module 5 (FIV)
 * Permanent record of every payment attempt, pass or fail.
 * Never expires — financial audit trail must be kept indefinitely.
 */
const mongoose = require('mongoose');

const feeAuditLogSchema = new mongoose.Schema({
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  amount:       { type: Number, required: true },
  outstanding:  { type: Number, required: true },
  passed:       { type: Boolean, required: true },
  failReason:   { type: String, default: null },
  timestamp:    { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('FeeAuditLog', feeAuditLogSchema);
