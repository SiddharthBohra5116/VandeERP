const mongoose = require('mongoose');
const { ASSIGNMENT_SUBMISSION_STATUSES } = require('../config/constants');

const submissionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  note: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  marks: { type: Number, default: null },
  feedback: { type: String, default: '' },
  status: { type: String, enum: ASSIGNMENT_SUBMISSION_STATUSES, default: 'submitted' }
});

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { type: Date, required: true },
  totalMarks: { type: Number, default: 100 },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  submissions: [submissionSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// VIRTUALS
assignmentSchema.virtual('submissionCount').get(function() {
  return this.submissions.length;
});

assignmentSchema.set('toObject', { virtuals: true });
assignmentSchema.set('toJSON', { virtuals: true });

// INDEXES
assignmentSchema.index({ batch: 1, teacher: 1 });
assignmentSchema.index({ course: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
