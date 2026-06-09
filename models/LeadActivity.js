const mongoose = require('mongoose');

const leadActivitySchema = new mongoose.Schema({

  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true
  },

  type: {
    type: String,
    enum: [
      'lead_created',
      'assigned',
      'reassigned',
      'status_changed',
      'call',
      'whatsapp',
      'note',
      'parent_discussion',
      'fee_discussion',
      'mentorship_scheduled',
      'mentorship_attended',
      'follow_up_scheduled',
      'follow_up_completed',
      'follow_up_missed',
      'lost',
      'converted'
    ],
    required: true
  },

  title: {
    type: String,
    required: true
  },

  note: {
    type: String,
    default: ''
  },

  counsellor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  doneBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  call: {
    outcome: {
      type: String,
      enum: ['answered', 'busy', 'no-answer', 'callback', 'switched-off', 'wrong-number', 'not-applicable'],
      default: 'not-applicable'
    },

    duration: {
      type: String,
      default: ''
    }
  },

  whatsapp: {
    direction: {
      type: String,
      enum: ['sent', 'received', 'none'],
      default: 'none'
    },

    message: {
      type: String,
      default: ''
    }
  },

  followUp: {
    scheduledFor: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    },

    isMissed: {
      type: Boolean,
      default: false
    }
  },

  oldStatus: {
    type: String,
    default: ''
  },

  newStatus: {
    type: String,
    default: ''
  },

  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }

}, { timestamps: true });


leadActivitySchema.index({ lead: 1, createdAt: -1 });
leadActivitySchema.index({ counsellor: 1, createdAt: -1 });
leadActivitySchema.index({ type: 1, createdAt: -1 });
leadActivitySchema.index({ 'followUp.scheduledFor': 1 });

module.exports = mongoose.model('LeadActivity', leadActivitySchema);