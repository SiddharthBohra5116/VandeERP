const mongoose = require('mongoose');

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'checkbox'];

const leadCustomFieldSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true, maxlength: 60 },
  key: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
  type: { type: String, enum: FIELD_TYPES, required: true },
  options: [{ type: String, trim: true, maxlength: 60 }],
  required: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

leadCustomFieldSchema.index({ isActive: 1, createdAt: 1 });

module.exports = mongoose.model('LeadCustomField', leadCustomFieldSchema);
module.exports.FIELD_TYPES = FIELD_TYPES;
