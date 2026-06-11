const mongoose = require('mongoose');
const { LEAD_ACTIVITY_TYPES, CALL_OUTCOMES, WHATSAPP_DIRECTIONS } = require('../config/constants');

const leadActivitySchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  type: { type: String, enum: LEAD_ACTIVITY_TYPES, required: true },
  title: { type: String, required: true },
  note: { type: String, default: '' },
  counsellor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  doneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  call: {
    outcome: { type: String, enum: CALL_OUTCOMES, default: 'not-applicable' },
    duration: { type: String, default: '' }
  },
  whatsapp: {
    direction: { type: String, enum: WHATSAPP_DIRECTIONS, default: 'none' },
    message: { type: String, default: '' }
  },
  followUp: {
    scheduledFor: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    isMissed: { type: Boolean, default: false }
  },
  oldStatus: { type: String, default: '' },
  newStatus: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

leadActivitySchema.index({ lead: 1, createdAt: -1 });
leadActivitySchema.index({ counsellor: 1, createdAt: -1 });
leadActivitySchema.index({ type: 1, createdAt: -1 });
leadActivitySchema.index({ 'followUp.scheduledFor': 1 });

module.exports = mongoose.model('LeadActivity', leadActivitySchema);