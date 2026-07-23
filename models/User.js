const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, USER_STATUSES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  password: {
    type: String,
    required: true,
    minlength: 6
  },

  role: {
    type: String,
    enum: ROLES,
    required: true
  },

  phone: {
    type: String,
    default: '',
    trim: true
  },

  profilePic: {
    type: String,
    default: null
  },
  profilePicPublicId: {
    type: String,
    default: null
  },
  profilePicResourceType: {
    type: String,
    default: null
  },

  status: {
    type: String,
    enum: USER_STATUSES,
    default: 'active'
  },

  isActive: {
    type: Boolean,
    default: true
  },

  address: {
    type: String,
    default: ''
  },

  city: {
    type: String,
    default: ''
  },

  dob: {
    type: Date,
    default: null
  },

  socialHandle: {
    instagram: {
      type: String,
      default: ''
    },
    linkedin: {
      type: String,
      default: ''
    }
  },

  lastLoginAt: {
    type: Date,
    default: null
  },

  readNotifications: [{
    type: String
  }],

  resetRequested: {
    type: Boolean,
    default: false
  },

  mustChangePassword: {
    type: Boolean,
    default: false
  },

  passwordSetByAdmin: {
    type: Boolean,
    default: false
  },

  firstLoginCompleted: {
    type: Boolean,
    default: true
  },

  profileIncomplete: {
    type: Boolean,
    default: false
  },

  // Security: timestamp before which ALL tokens for this user are invalid.
  // Set by admin blacklist action. Any JWT with iat < this value is rejected.
  tokenBlacklistedBefore: { type: Date, default: null },
  // Security: timestamp of last password change for token freshness checks
  passwordChangedAt: { type: Date, default: null },

  archivedAt: { type: Date, default: null },
  anonymizedAt: { type: Date, default: null },

}, { timestamps: true });

// HASH PASSWORD
userSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (err) {
    next(err);
  }
});

// SYNC STATUS AND ISACTIVE
userSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.isActive = this.status === 'active';
  }

  if (this.isModified('isActive')) {
    if (this.isActive) {
      this.status = 'active';
    } else if (this.status === 'active') {
      this.status = 'inactive';
    }
  }

  next();
});

// MATCH PASSWORD
userSchema.methods.matchPassword = async function(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// INITIALS
userSchema.virtual('initials').get(function() {
  if (!this.name) return '';

  return this.name
    .split(' ')
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    return ret;
  }
});

userSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
