const mongoose = require('mongoose');
const { generateRollNumber } = require('../utils/rollNumberHelper');

const teacherSchema = new mongoose.Schema({

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  rollNumber: {
    type: String,
    unique: true,
    trim: true
  },

  courses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],

  qualification: {
    type: String,
    default: ''
  },

  experienceYears: {
    type: Number,
    default: 0
  },

  salary: {
    type: Number,
    default: 0
  },

  joiningDate: {
    type: Date,
    default: Date.now
  },

  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }

}, { timestamps: true });

teacherSchema.pre('save', async function(next) {
  try {
    await generateRollNumber(this, 'teacher', 'TCH');
    next();
  } catch (err) {
    next(err);
  }
});

// VIRTUALS
teacherSchema.virtual('name').get(function() {
  return this.user && this.user.name ? this.user.name : '';
});

teacherSchema.virtual('email').get(function() {
  return this.user && this.user.email ? this.user.email : '';
});

teacherSchema.virtual('phone').get(function() {
  return this.user && this.user.phone ? this.user.phone : '';
});

teacherSchema.virtual('profilePic').get(function() {
  return this.user && this.user.profilePic ? this.user.profilePic : '';
});

teacherSchema.virtual('initials').get(function() {
  return this.user && this.user.initials ? this.user.initials : '';
});

teacherSchema.set('toJSON', { virtuals: true });
teacherSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Teacher', teacherSchema);