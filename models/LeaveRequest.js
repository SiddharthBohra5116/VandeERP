const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  startDate: {
    type: String,
    required: true
  },

  endDate: {
    type: String,
    required: true
  },

  reason: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  approvedAt: {
    type: Date,
    default: null
  },

  rejectionReason: {
    type: String,
    default: ''
  },

  appliedAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });


leaveRequestSchema.index({
  user: 1,
  status: 1
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);