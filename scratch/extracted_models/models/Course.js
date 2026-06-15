const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({

  title: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    default: ''
  },

  order: {
    type: Number,
    default: 0
  }

}, { _id: true });


const moduleSchema = new mongoose.Schema({

  title: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    default: ''
  },

  order: {
    type: Number,
    default: 0
  },

  topics: [topicSchema]

}, { _id: true });


const courseSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },

  description: {
    type: String,
    default: ''
  },

  durationMonths: {
    type: Number,
    default: 3
  },

  fees: {
    type: Number,
    default: 0
  },

  modules: [moduleSchema],

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });


courseSchema.virtual('moduleCount').get(function() {
  return this.modules.length;
});


courseSchema.virtual('topicCount').get(function() {

  return this.modules.reduce(
    (total, module) => total + module.topics.length,
    0
  );

});

courseSchema.set('toObject', { virtuals: true });
courseSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Course', courseSchema);