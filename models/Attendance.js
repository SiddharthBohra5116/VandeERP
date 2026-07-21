const mongoose = require('mongoose');
const { ATTENDANCE_STATUSES } = require('../config/constants');

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },

  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null
  },

  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },

  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },

  date: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ATTENDANCE_STATUSES,
    default: 'absent'
  },

  note: {
    type: String,
    default: ''
  },

  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  changeReason: { type: String, default: '' },
  entrySource: { type: String, enum: ['teacher', 'admin'], default: 'teacher' },
  revisions: [{
    status: { type: String, enum: ATTENDANCE_STATUSES },
    note: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String, required: true }
  }]

}, { timestamps: true });

// ONE RECORD PER STUDENT PER DAY
attendanceSchema.index({ student: 1, date: 1 }, { unique: true });

// FAST ATTENDANCE LOOKUP
attendanceSchema.index({ batch: 1, date: 1 });
attendanceSchema.index({ course: 1 });
attendanceSchema.index({ teacher: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
