const mongoose = require('mongoose');

const timetableSlotSchema = new mongoose.Schema({
  dayOfWeek: { type: String, required: true, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
  subject: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true }
});

const timetableSchema = new mongoose.Schema({
  batch: { type: String, required: true, unique: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  slots: [timetableSlotSchema]
}, { timestamps: true });

module.exports = mongoose.model('Timetable', timetableSchema);
