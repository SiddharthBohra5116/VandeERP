const mongoose = require('mongoose');
const { generateRollNumber } = require('../utils/rollNumberHelper');

const counsellorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  rollNumber: {
    type: String,
    unique: true
  }
}, { timestamps: true });

counsellorSchema.pre('save', async function(next) {
  try {
    await generateRollNumber(this, 'counsellor', 'CNS');
    next();
  } catch (err) {
    next(err);
  }
});

// VIRTUALS
counsellorSchema.virtual('name').get(function() {
  return this.user && this.user.name ? this.user.name : '';
});

counsellorSchema.virtual('email').get(function() {
  return this.user && this.user.email ? this.user.email : '';
});

counsellorSchema.virtual('phone').get(function() {
  return this.user && this.user.phone ? this.user.phone : '';
});

counsellorSchema.virtual('profilePic').get(function() {
  return this.user && this.user.profilePic ? this.user.profilePic : '';
});

counsellorSchema.set('toJSON', { virtuals: true });
counsellorSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Counsellor', counsellorSchema);