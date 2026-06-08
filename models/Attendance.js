const mongoose = require('mongoose');
const { ATTENDANCE_STATUSES } = require('../config/constants');

const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ATTENDANCE_STATUSES, default: 'absent' },
  note: { type: String, default: '' }
}, { timestamps: true });

// ONE RECORD PER STUDENT PER DAY
attendanceSchema.index({ student: 1, date: 1 }, { unique: true });

// FAST ATTENDANCE LOOKUP
attendanceSchema.index({ batch: 1, date: 1 });
attendanceSchema.index({ course: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
