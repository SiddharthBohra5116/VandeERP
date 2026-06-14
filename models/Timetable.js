const mongoose = require('mongoose');
const { DAYS_OF_WEEK } = require('../config/constants');

const timetableSlotSchema = new mongoose.Schema({
  dayOfWeek: {
    type: String,
    required: true,
    enum: DAYS_OF_WEEK
  },

  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },

  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true
  },

  startTime: {
    type: String,
    required: true
  },

  endTime: {
    type: String,
    required: true
  },

  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  note: {
    type: String,
    default: ''
  }
}, { _id: true });

const timetableSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },

  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    unique: true
  },

  startDate: {
    type: Date,
    required: true
  },

  endDate: {
    type: Date,
    required: true
  },

  slots: [timetableSlotSchema]

}, { timestamps: true });

timetableSchema.index({ course: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);