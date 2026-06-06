const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Counter = require('./Counter');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['student', 'teacher', 'counsellor', 'admin'], required: true },
  phone: { type: String, trim: true },
  avatar: { type: String, default: '' }, // initials fallback
  rollNumber: { type: String, unique: true, sparse: true },
  counsellor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Student-specific
  course: { type: String, enum: ['Video Editing', 'Digital Marketing', 'Both'], default: null },
  batch: { type: String, default: null },
  enrollmentDate: { type: Date, default: null },
  fees_total: { type: Number, default: 0 },
  fees_paid: { type: Number, default: 0 },

  // Teacher-specific
  subject: { type: String, default: null },
  qualification: { type: String, default: null },

  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ['active', 'inactive', 'drop', 'complete'], default: 'active' },
  profilePic: { type: String, default: null }, // uploaded file path
  resetRequested: { type: Boolean, default: false },

  // Parent/Guardian Info
  fatherName: { type: String, default: '' },
  motherName: { type: String, default: '' },
  guardianPhone: { type: String, default: '' },
  guardianRelation: { type: String, default: '' },

  // Identity Verification
  idProof: { type: String, default: null },
  idVerified: { type: Boolean, default: false },

  // Status Change History
  statusHistory: [{
    status: { type: String, enum: ['active', 'inactive', 'drop', 'complete'] },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, default: '' },
    date: { type: Date, default: Date.now }
  }],

  // Course feedback (Blocking form once complete)
  feedback: {
    submitted: { type: Boolean, default: false },
    teacherRating: { type: Number, default: 0 },
    contentRating: { type: Number, default: 0 },
    facilitiesRating: { type: Number, default: 0 },
    comments: { type: String, default: '' },
    submittedAt: { type: Date }
  },

  // Multi-role Remarks Timeline
  remarks: [{
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String },
    note: { type: String },
    date: { type: Date, default: Date.now }
  }],

  // Extended Profile Fields
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  dob: { type: Date, default: null },
  highestQualification: { type: String, default: '' },
  referralSource: { type: String, default: '' },
  socialHandle: { type: String, default: '' },
  lastLoginAt: { type: Date, default: null },
  readNotifications: [{ type: String, default: [] }],
  pendingProfileUpdate: {
    name: { type: String, default: null },
    phone: { type: String, default: null },
    profilePic: { type: String, default: null },
    fatherName: { type: String, default: null },
    motherName: { type: String, default: null },
    address: { type: String, default: null },
    city: { type: String, default: null },
    dob: { type: Date, default: null },
    requestedAt: { type: Date, default: null }
  }
}, { timestamps: true });

// Hash password & generate rollNumber before save
userSchema.pre('save', async function (next) {
  // 1. Sync status and isActive bidirectional
  if (this.isModified('status') || this.isNew) {
    this.isActive = (this.status === 'active');
  } else if (this.isModified('isActive')) {
    if (this.isActive) {
      this.status = 'active';
    } else {
      if (this.status === 'active') {
        this.status = 'inactive';
      }
    }
  }

// 2. Hash password
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Generate rollNumber
  if (this.isNew && !this.rollNumber) {
    try {
      const year = new Date().getFullYear().toString().slice(-2);
      
      let roleCode = 'STU';
      if (this.role === 'teacher') roleCode = 'TCH';
      if (this.role === 'counsellor') roleCode = 'CNS';
      if (this.role === 'admin') roleCode = 'ADM';
      
      let courseCode = 'XX';
      if (this.role === 'student' || this.role === 'teacher') {
        const val = (this.course || this.subject || '').trim();
        const valLower = val.toLowerCase();
        
        if (valLower.includes('video') && valLower.includes('marketing')) courseCode = 'BT';
        else if (valLower.includes('video') || valLower.includes('resolve') || valLower.includes('premiere')) courseCode = 'VE';
        else if (valLower.includes('marketing') || valLower.includes('seo') || valLower.includes('ad')) courseCode = 'DM';
        else if (valLower.includes('both')) courseCode = 'BT';
        else if (valLower.includes('graphic')) courseCode = 'GD';
        else if (valLower.includes('motion') || valLower.includes('animation')) courseCode = 'AM';
        else if (valLower.includes('web')) courseCode = 'WD';
      }
      
      const counterId = `rollNumber_${this.role}_${year}`;
      const counter = await Counter.findByIdAndUpdate(
        counterId,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      
      const serial = String(counter.seq).padStart(3, '0');
      this.rollNumber = `VD-${roleCode}-${courseCode}-${year}-${serial}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

// Virtual: initials
userSchema.virtual('initials').get(function () {
  return this.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
});

// Virtual: fees due
userSchema.virtual('fees_due').get(function () {
  return this.fees_total - this.fees_paid;
});

// Virtual: fees percentage
userSchema.virtual('fees_pct').get(function () {
  return this.fees_total > 0 ? Math.round((this.fees_paid / this.fees_total) * 100) : 0;
});

userSchema.set('toObject', { virtuals: true });
userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);