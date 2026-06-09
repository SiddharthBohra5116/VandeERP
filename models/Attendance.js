const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({

  // STUDENT PROFILE
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },

  // TEACHER USER ACCOUNT
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // COURSE
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },

  // BATCH
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },

  // YYYY-MM-DD
  date: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ['present', 'absent', 'late'],
    default: 'absent'
  },

  note: {
    type: String,
    default: ''
  }

}, { timestamps: true });


// ONE RECORD PER STUDENT PER DAY
attendanceSchema.index(
  { student: 1, date: 1 },
  { unique: true }
);


// FAST ATTENDANCE LOOKUP
attendanceSchema.index({
  batch: 1,
  date: 1
});

attendanceSchema.index({
  course: 1
});

module.exports = mongoose.model('Attendance', attendanceSchema);

