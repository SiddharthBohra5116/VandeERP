const mongoose = require('mongoose');
const { generateRollNumber } = require('../utils/rollNumberHelper');

const pendingProfileUpdateSchema = new mongoose.Schema({
  name: { type: String, default: null },
  phone: { type: String, default: null },
  profilePic: { type: String, default: null },
  fatherName: { type: String, default: null },
  fatherPhone: { type: String, default: null },
  motherName: { type: String, default: null },
  motherPhone: { type: String, default: null },
  guardianName: { type: String, default: null },
  guardianRelation: { type: String, default: null },
  guardianPhone: { type: String, default: null },
  address: { type: String, default: null },
  city: { type: String, default: null },
  dob: { type: Date, default: null },
  requestedAt: { type: Date, default: null }
}, { _id: false });

const studentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  rollNumber: {
    type: String,
    unique: true
  },

  counsellor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Counsellor',
    default: null
  },

  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null
  },

  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },

  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    default: null
  },

  enrollmentDate: {
    type: Date,
    default: Date.now
  },

  fees_total: {
    type: Number,
    default: 0
  },

  fees_paid: {
    type: Number,
    default: 0
  },

  family: {
    father: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' }
    },
    mother: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' }
    },
    guardian: {
      name: { type: String, default: '' },
      relation: { type: String, default: '' },
      phone: { type: String, default: '' }
    }
  },

  documents: {
    profilePic: {
      type: String,
      default: null
    },
    idProof: {
      type: String,
      default: null
    }
  },

  idVerified: {
    type: Boolean,
    default: false
  },

  pendingProfileUpdate: {
    type: pendingProfileUpdateSchema,
    default: () => ({
      name: null,
      phone: null,
      profilePic: null,
      fatherName: null,
      fatherPhone: null,
      motherName: null,
      motherPhone: null,
      guardianName: null,
      guardianRelation: null,
      guardianPhone: null,
      address: null,
      city: null,
      dob: null,
      requestedAt: null
    })
  },

  remarks: [{
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String
    },
    note: {
      type: String
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],

  statusHistory: [{
    status: {
      type: String
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      default: ''
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],

  feedback: {
    submitted: {
      type: Boolean,
      default: false
    },
    teacherRating: {
      type: Number,
      default: 0
    },
    contentRating: {
      type: Number,
      default: 0
    },
    facilitiesRating: {
      type: Number,
      default: 0
    },
    comments: {
      type: String,
      default: ''
    },
    submittedAt: {
      type: Date,
      default: null
    }
  }

}, { timestamps: true });

studentSchema.virtual('fees_due').get(function() {
  return Math.max(0, this.fees_total - this.fees_paid);
});

studentSchema.virtual('fees_pct').get(function() {
  if (this.fees_total <= 0) return 0;
  return Math.round((this.fees_paid / this.fees_total) * 100);
});

studentSchema.virtual('name').get(function() {
  return this.user && this.user.name ? this.user.name : '';
});

studentSchema.virtual('email').get(function() {
  return this.user && this.user.email ? this.user.email : '';
});

studentSchema.virtual('phone').get(function() {
  return this.user && this.user.phone ? this.user.phone : '';
});

studentSchema.virtual('status').get(function() {
  return this.user && this.user.status ? this.user.status : '';
});

studentSchema.virtual('profilePic').get(function() {
  return this.user && this.user.profilePic ? this.user.profilePic : '';
});

studentSchema.virtual('fatherName').get(function() {
  return this.family && this.family.father && this.family.father.name ? this.family.father.name : '';
});

studentSchema.virtual('fatherPhone').get(function() {
  return this.family && this.family.father && this.family.father.phone ? this.family.father.phone : '';
});

studentSchema.virtual('motherName').get(function() {
  return this.family && this.family.mother && this.family.mother.name ? this.family.mother.name : '';
});

studentSchema.virtual('motherPhone').get(function() {
  return this.family && this.family.mother && this.family.mother.phone ? this.family.mother.phone : '';
});

studentSchema.virtual('guardianName').get(function() {
  return this.family && this.family.guardian && this.family.guardian.name ? this.family.guardian.name : '';
});

studentSchema.virtual('guardianRelation').get(function() {
  return this.family && this.family.guardian && this.family.guardian.relation ? this.family.guardian.relation : '';
});

studentSchema.virtual('guardianPhone').get(function() {
  return this.family && this.family.guardian && this.family.guardian.phone ? this.family.guardian.phone : '';
});

studentSchema.virtual('address').get(function() {
  return this.user && this.user.address ? this.user.address : '';
});

studentSchema.virtual('city').get(function() {
  return this.user && this.user.city ? this.user.city : '';
});

studentSchema.virtual('dob').get(function() {
  return this.user && this.user.dob ? this.user.dob : null;
});

studentSchema.virtual('idProof').get(function() {
  return this.documents && this.documents.idProof ? this.documents.idProof : '';
});

studentSchema.pre('save', async function(next) {
  try {
    await generateRollNumber(this, 'student', 'STU');
    next();
  } catch (err) {
    next(err);
  }
});

studentSchema.index({ course: 1 });
studentSchema.index({ batch: 1 });
studentSchema.index({ counsellor: 1 });
studentSchema.index({ teacher: 1 });

studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);
