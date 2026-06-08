const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, USER_STATUSES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ROLES, required: true },
  phone: { type: String, default: '' },
  profilePic: { type: String, default: null },
  status: { type: String, enum: USER_STATUSES, default: 'active' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  dob: { type: Date, default: null },
  socialHandle: {
    instagram: { type: String, default: '' },
    linkedin: { type: String, default: '' }
  },
  lastLoginAt: { type: Date, default: null },
  readNotifications: [{ type: String }]
}, { timestamps: true });

// HASH PASSWORD
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// MATCH PASSWORD
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// INITIALS
userSchema.virtual('initials').get(function() {
  return this.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
});

module.exports = mongoose.model('User', userSchema);