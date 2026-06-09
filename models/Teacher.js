const mongoose = require('mongoose');
const Counter = require('./Counter');

const teacherSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  rollNumber: {
    type: String,
    unique: true
  },

  subjects: [{
    type: String
  }],

  qualification: {
    type: String,
    default: ''
  },

  experienceYears: {
    type: Number,
    default: 0
  }

}, { timestamps: true });


// ROLL NUMBER
teacherSchema.pre('save', async function(next) {

  if (!this.isNew || this.rollNumber) {
    return next();
  }

  try {

    const year = new Date()
      .getFullYear()
      .toString()
      .slice(-2);

    const counter = await Counter.findByIdAndUpdate(
      `teacher_${year}`,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const serial = String(counter.seq).padStart(3, '0');

    this.rollNumber = `VD-TCH-XX-${year}-${serial}`;

    next();

  } catch(err) {
    next(err);
  }

});

module.exports = mongoose.model('Teacher', teacherSchema);
