const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  completed: { type: Boolean, default: false },
  completedDate: { type: String, default: null },
  order: { type: Number, default: 0 },
});

const curriculumSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  batch: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topics: [topicSchema],
  description: { type: String, default: '' },
}, { timestamps: true });

// Compound index — one curriculum per subject per batch
curriculumSchema.index({ subject: 1, batch: 1 }, { unique: true });

// Virtual: completion %
curriculumSchema.virtual('completionPct').get(function () {
  if (!this.topics.length) return 0;
  const done = this.topics.filter(t => t.completed).length;
  return Math.round((done / this.topics.length) * 100);
});

curriculumSchema.set('toObject', { virtuals: true });
curriculumSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Curriculum', curriculumSchema);