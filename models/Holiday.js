const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true
  },

  date: {
    type: String,
    required: true,
    unique: true
  },

  type: {
    type: String,
    enum: ['public', 'academy', 'festival', 'other'],
    default: 'academy'
  },

  note: {
    type: String,
    default: ''
  }

}, { timestamps: true });

module.exports = mongoose.model('Holiday', holidaySchema);