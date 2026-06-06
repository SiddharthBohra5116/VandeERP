const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  batch: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD format for easy querying
  status: { type: String, enum: ['present', 'absent', 'late'], default: 'absent' },
  note: { type: String, default: '' },
}, { timestamps: true });

// Compound index — one record per student per subject per date
attendanceSchema.index({ student: 1, subject: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
