const mongoose = require('mongoose');
const { generateRollNumber } = require('../utils/rollNumberHelper');

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
  try {
    await generateRollNumber(this, 'counsellor', 'CNS');
    next();
  } catch (err) {
    next(err);
  }
});

counsellorSchema.set('toJSON', { virtuals: true });
counsellorSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Counsellor', counsellorSchema);