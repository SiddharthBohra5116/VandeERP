const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
<<<<<<< HEAD

  testName: {
    type: String,
    required: true
  },

  score: {
    type: Number,
    required: true
  },

  totalMarks: {
    type: Number,
    required: true
  },

  date: {
    type: String,
    required: true
  },

  remarks: {
    type: String,
    default: ''
  }

});


const progressSchema = new mongoose.Schema({

  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },

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

  testResults: [testResultSchema],

  overallScore: {
    type: Number,
    default: 0
  },

  teacherRemark: {
    type: String,
    default: ''
  }

}, { timestamps: true });


// one progress record per student per batch
progressSchema.index({
  student: 1,
  batch: 1
}, { unique: true });


// Auto-calculate overallScore
progressSchema.pre('save', function(next) {

  if (this.testResults.length > 0) {

    const total = this.testResults.reduce((sum, test) => {

      if (!test.totalMarks || test.totalMarks <= 0) {
        return sum;
      }

      return sum + ((test.score / test.totalMarks) * 100);

    }, 0);

    this.overallScore = Math.round(total / this.testResults.length);

  }

  next();

=======
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
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  testResults: [testResultSchema],
  overallScore: { type: Number, default: 0 },
  teacherRemark: { type: String, default: '' }
}, { timestamps: true });

// one progress record per student per batch
progressSchema.index({ student: 1, batch: 1 }, { unique: true });

// Auto-calculate overallScore
progressSchema.pre('save', function(next) {
  if (this.testResults.length > 0) {
    const total = this.testResults.reduce((sum, test) => {
      if (!test.totalMarks || test.totalMarks <= 0) return sum;
      return sum + ((test.score / test.totalMarks) * 100);
    }, 0);
    this.overallScore = Math.round(total / this.testResults.length);
  }
  next();
>>>>>>> origin/main
});

module.exports = mongoose.model('Progress', progressSchema);