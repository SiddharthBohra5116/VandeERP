const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // DYNAMIC COURSE
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },

  capacity: {
    type: Number,
    default: 20
  },

  // TEACHER USER ACCOUNTS
  teachers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  startDate: {
    type: Date,
    default: null
  },

  endDate: {
    type: Date,
    default: null
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });


// INDEXES
batchSchema.index({
  course: 1
});

module.exports = mongoose.model('Batch', batchSchema);
