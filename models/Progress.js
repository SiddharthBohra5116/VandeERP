const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  testName: { type: String, required: true },
  score: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  date: { type: String, required: true },
  remarks: { type: String, default: '' }
});

const progressSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  testResults: [testResultSchema],
  overallScore: { type: Number, default: 0 },
  teacherRemark: { type: String, default: '' }
}, { timestamps: true });

progressSchema.index({ student: 1, course: 1 }, { unique: true });
progressSchema.index({ teacher: 1 });

progressSchema.pre('save', function(next) {
  if (Array.isArray(this.testResults) && this.testResults.length > 0) {
    const validTests = this.testResults.filter(test => test.totalMarks && test.totalMarks > 0);

    if (validTests.length > 0) {
      const total = validTests.reduce((sum, test) => {
        return sum + ((test.score / test.totalMarks) * 100);
      }, 0);

      this.overallScore = Math.round(total / validTests.length);
    }
  }

  next();
});

module.exports = mongoose.model('Progress', progressSchema);