const mongoose = require('mongoose');
const { HOLIDAY_TYPES } = require('../config/constants');

const holidaySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  date: { type: String, required: true, unique: true },
  type: { type: String, enum: HOLIDAY_TYPES, default: 'academy' },
  note: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Holiday', holidaySchema);