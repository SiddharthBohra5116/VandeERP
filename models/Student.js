const mongoose = require('mongoose');
const { generateRollNumber } = require('../utils/rollNumberHelper');

const studentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  rollNumber: { type: String, unique: true },
  counsellor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: String, default: '' },
  enrollmentDate: { type: Date, default: Date.now },
  fees_total: { type: Number, default: 0 },
  fees_paid: { type: Number, default: 0 },
  family: {
    father: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' }
    },
    mother: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' }
    },
    guardian: {
      name: { type: String, default: '' },
      relation: { type: String, default: '' },
      phone: { type: String, default: '' }
    }
  },
  documents: {
    profilePic: { type: String, default: null },
    idProof: { type: String, default: null }
  },
  feedback: {
    submitted: { type: Boolean, default: false },
    teacherRating: { type: Number, default: 0 },
    contentRating: { type: Number, default: 0 },
    facilitiesRating: { type: Number, default: 0 },
    comments: { type: String, default: '' },
    submittedAt: { type: Date, default: null }
  }
}, { timestamps: true });

// FEES DUE
studentSchema.virtual('fees_due').get(function () {
  return this.fees_total - this.fees_paid;
});

// FEES %
studentSchema.virtual('fees_pct').get(function () {
  if (this.fees_total <= 0) return 0;
  return Math.round((this.fees_paid / this.fees_total) * 100);
});

// ROLL NUMBER
studentSchema.pre('save', async function (next) {
  try {
    await generateRollNumber(this, 'student', 'STU');
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Student', studentSchema);