const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileUrl: { type: String, default: null },       // uploaded file path
  fileName: { type: String, default: null },
  note: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  marks: { type: Number, default: null },          // teacher grades this
  feedback: { type: String, default: '' },
  status: { type: String, enum: ['submitted', 'graded', 'late'], default: 'submitted' },
});

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  subject: { type: String, required: true },
  batch: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { type: Date, required: true },
  totalMarks: { type: Number, default: 100 },
  fileUrl: { type: String, default: null },   // teacher's reference file
  fileName: { type: String, default: null },
  submissions: [submissionSchema],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Virtual: submission count
assignmentSchema.virtual('submissionCount').get(function () {
  return this.submissions.length;
});

assignmentSchema.set('toObject', { virtuals: true });
assignmentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Assignment', assignmentSchema);