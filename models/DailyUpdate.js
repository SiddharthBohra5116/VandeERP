const mongoose = require('mongoose');

const coveredTopicSchema = new mongoose.Schema({
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  title: {
    type: String,
    default: ''
  },

  note: {
    type: String,
    default: ''
  }
}, { _id: false });

const dailyUpdateSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    default: ''
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
    ref: 'Teacher',
    required: true
  },

  content: {
    type: String,
    default: ''
  },

  topics: [{
    type: String,
    trim: true
  }],

  homework: {
    type: String,
    default: ''
  },

  fileUrl: {
    type: String,
    default: null
  },
  filePublicId: { type: String, default: null },
  fileResourceType: { type: String, default: null },
  fileDeliveryType: { type: String, default: null },

  fileName: {
    type: String,
    default: null
  },

  date: {
    type: String,
    required: true
  },

  coveredTopics: [coveredTopicSchema]

}, { timestamps: true });

// VIRTUALS
dailyUpdateSchema.virtual('subject').get(function() {
  return this.course && this.course.name ? this.course.name : '';
});

dailyUpdateSchema.set('toJSON', { virtuals: true });
dailyUpdateSchema.set('toObject', { virtuals: true });

dailyUpdateSchema.index({ batch: 1, date: 1 });
dailyUpdateSchema.index({ teacher: 1, date: 1 });
dailyUpdateSchema.index({ course: 1, date: 1 });

module.exports = mongoose.model('DailyUpdate', dailyUpdateSchema);
