const mongoose = require('mongoose');

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

  content: {
    type: String,
    default: ''
  },

  homework: {
    type: String,
    default: ''
  },

  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  fileUrl: {
    type: String,
    default: null
  },

  fileName: {
    type: String,
    default: null
  },

  date: {
    type: String,
    required: true
  },

  coveredTopics: [{
    moduleId: {
      type: mongoose.Schema.Types.ObjectId
    },

    topicId: {
      type: mongoose.Schema.Types.ObjectId
    },

    title: {
      type: String,
      default: ''
    }
  }]

}, { timestamps: true });


dailyUpdateSchema.index({
  batch: 1,
  date: 1
});

dailyUpdateSchema.index({
  teacher: 1,
  date: 1
});

module.exports = mongoose.model('DailyUpdate', dailyUpdateSchema);