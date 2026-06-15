const mongoose = require('mongoose');
const { DAYS_OF_WEEK } = require('../config/constants');

const timetableSlotSchema = new mongoose.Schema({
  dayOfWeek: { type: String, required: true, enum: DAYS_OF_WEEK },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  note: { type: String, default: '' }
});

const timetableSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, unique: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  slots: [timetableSlotSchema]
}, { timestamps: true });

// Note: batch is already unique indexed, so only index course
timetableSchema.index({ course: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);