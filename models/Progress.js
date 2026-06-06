const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  testName: { type: String, required: true },
  score: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  date: { type: String, required: true },
  remarks: { type: String, default: '' },
});

const progressSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  testResults: [testResultSchema],
  overallScore: { type: Number, default: 0 },   // calculated average
  teacherRemark: { type: String, default: '' },
}, { timestamps: true });

// Compound index — one record per student per subject
progressSchema.index({ student: 1, subject: 1 }, { unique: true });

// Auto-calculate overallScore before save
progressSchema.pre('save', function (next) {
  if (this.testResults.length > 0) {
    const total = this.testResults.reduce((sum, t) => sum + (t.score / t.totalMarks) * 100, 0);
    this.overallScore = Math.round(total / this.testResults.length);
  }
  next();
});

module.exports = mongoose.model('Progress', progressSchema);
