const mongoose = require('mongoose');
const Counter = require('./Counter');

const counsellorSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  rollNumber: {
    type: String,
    unique: true
  }

}, { timestamps: true });


// ROLL NUMBER
counsellorSchema.pre('save', async function(next) {

  if (!this.isNew || this.rollNumber) {
    return next();
  }

  try {

    const year = new Date()
      .getFullYear()
      .toString()
      .slice(-2);

    const counter = await Counter.findByIdAndUpdate(
      `counsellor_${year}`,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const serial = String(counter.seq).padStart(3, '0');

    this.rollNumber = `VD-CNS-XX-${year}-${serial}`;

    next();

  } catch(err) {
    next(err);
  }

});

module.exports = mongoose.model('Counsellor', counsellorSchema);