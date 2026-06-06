const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  subject: { type: String, required: true, trim: true },
  batch: { type: String, required: true, trim: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  startTime: { type: String, required: true }, // e.g. "10:00 AM"
  endTime: { type: String, required: true }, // e.g. "11:30 AM"
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  note: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Schedule', scheduleSchema);
