const mongoose = require('mongoose');
<<<<<<< HEAD

const scheduleSchema = new mongoose.Schema({

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

  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true
  },

  date: {
    type: String,
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

  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },

  note: {
    type: String,
    trim: true,
    default: ''
  }

}, { timestamps: true });


scheduleSchema.index({
  batch: 1,
  date: 1
});

scheduleSchema.index({
  teacher: 1,
  date: 1
});

scheduleSchema.index({
  classroom: 1,
  date: 1
});
=======
const { SCHEDULE_STATUSES } = require('../config/constants');

const scheduleSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  status: { type: String, enum: SCHEDULE_STATUSES, default: 'scheduled' },
  note: { type: String, trim: true, default: '' }
}, { timestamps: true });

scheduleSchema.index({ batch: 1, date: 1 });
scheduleSchema.index({ teacher: 1, date: 1 });
scheduleSchema.index({ classroom: 1, date: 1 });
>>>>>>> origin/main

module.exports = mongoose.model('Schedule', scheduleSchema);