const mongoose = require('mongoose');

const leadStatusSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },

  label: {
    type: String,
    required: true,
    trim: true
  },

  badgeClass: {
    type: String,
    default: 'badge-grey',
    trim: true
  },

  isClosed: {
    type: Boolean,
    default: false
  },

  isSystem: {
    type: Boolean,
    default: false
  },

  isDeleted: {
    type: Boolean,
    default: false
  },

  deletedAt: {
    type: Date,
    default: null
  },

  sortOrder: {
    type: Number,
    default: 100
  }
}, { timestamps: true });

leadStatusSchema.index({ sortOrder: 1, label: 1 });

module.exports = mongoose.model('LeadStatus', leadStatusSchema);
