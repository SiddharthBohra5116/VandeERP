const mongoose = require('mongoose');
const {
  LEAD_SOURCES,
  LEAD_TYPES,
  LEAD_CATEGORIES,
  LEAD_STATUSES,
  LOST_REASONS,
  AUTOMATION_PROVIDERS
} = require('../config/constants');

const ownershipSchema = new mongoose.Schema({
  counsellor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counsellor',
    required: true
  },

  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  assignedAt: {
    type: Date,
    default: Date.now
  },

  note: {
    type: String,
    default: ''
  }
}, { _id: false });

const followUpSchema = new mongoose.Schema({
  note: {
    type: String,
    default: ''
  },

  status: {
    type: String,
    default: ''
  },

  channel: {
    type: String,
    default: ''
  },

  callOutcome: {
    type: String,
    default: ''
  },

  callDuration: {
    type: String,
    default: ''
  },

  callAttemptNumber: {
    type: Number,
    default: null
  },

  doneBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  doneAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  phone: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },

  interestedCourse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null
  },

  source: {
    type: String,
    enum: LEAD_SOURCES,
    default: 'Manual'
  },

  leadType: {
    type: String,
    enum: LEAD_TYPES,
    default: 'manual'
  },

  category: {
    type: String,
    enum: LEAD_CATEGORIES,
    default: 'warm'
  },

  status: {
    type: String,
    enum: LEAD_STATUSES,
    default: 'new'
  },

  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counsellor',
    default: null
  },

  ownershipHistory: [ownershipSchema],
  followUpHistory: [followUpSchema],

  nextFollowUpAt: {
    type: Date,
    default: null
  },

  lastContactedAt: {
    type: Date,
    default: null
  },

  mentorship: {
    scheduledAt: {
      type: Date,
      default: null
    },

    attendedAt: {
      type: Date,
      default: null
    },

    takenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    feedback: {
      type: String,
      default: ''
    }
  },

  lostReason: {
    type: String,
    enum: LOST_REASONS,
    default: ''
  },

  lostNote: {
    type: String,
    default: ''
  },

  automation: {
    provider: {
      type: String,
      enum: AUTOMATION_PROVIDERS,
      default: 'none'
    },

    externalLeadId: {
      type: String,
      default: ''
    },

    campaignName: {
      type: String,
      default: ''
    },

    formName: {
      type: String,
      default: ''
    },

    adName: {
      type: String,
      default: ''
    },

    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  convertedStudent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    default: null
  },

  convertedAt: {
    type: Date,
    default: null
  }

}, { timestamps: true });

leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ nextFollowUpAt: 1 });
leadSchema.index({ source: 1, createdAt: -1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ category: 1 });
leadSchema.index({ convertedStudent: 1 });

module.exports = mongoose.model('Lead', leadSchema);