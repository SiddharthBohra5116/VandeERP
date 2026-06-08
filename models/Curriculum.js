const mongoose = require('mongoose');

const completedTopicSchema = new mongoose.Schema({
  moduleId: { type: mongoose.Schema.Types.ObjectId, required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, required: true },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedDate: { type: String, required: true },
  note: { type: String, default: '' }
}, { _id: false });

const curriculumSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedTopics: [completedTopicSchema],
  description: { type: String, default: '' }
}, { timestamps: true });

// One curriculum progress record per course + batch
curriculumSchema.index({ course: 1, batch: 1 }, { unique: true });

// Virtual: completed topic count
curriculumSchema.virtual('completedCount').get(function() {
  return this.completedTopics.length;
});

module.exports = mongoose.model('Curriculum', curriculumSchema);