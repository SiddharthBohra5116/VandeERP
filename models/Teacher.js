const mongoose = require('mongoose');
const { generateRollNumber } = require('../utils/rollNumberHelper');

const teacherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  rollNumber: { type: String, unique: true },
  subjects: [{ type: String }],
  qualification: { type: String, default: '' },
  experienceYears: { type: Number, default: 0 }
}, { timestamps: true });

// ROLL NUMBER
teacherSchema.pre('save', async function(next) {
  try {
    await generateRollNumber(this, 'teacher', 'TCH');
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Teacher', teacherSchema);
