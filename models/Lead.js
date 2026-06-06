const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  note: { type: String, required: true },
  status: { type: String, required: true },
  channel: { type: String, enum: ['Call', 'WhatsApp', 'In-person'], default: 'Call' },
  callAttemptNumber: { type: Number, default: null },
  callDuration: { type: String, default: '' },
  callOutcome: { type: String, enum: ['answered', 'busy', 'voicemail', 'no-answer', 'callback'], default: 'answered' },
  doneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  doneAt: { type: Date, default: Date.now },
});

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true, default: '' },
  course: { type: String, enum: ['Video Editing', 'Digital Marketing', 'Both', 'Undecided'], default: 'Undecided' },
  source: { type: String, enum: ['Walk-in', 'Website', 'Referral', 'Social Media', 'Advertisement', 'WhatsApp', 'Other'], default: 'Walk-in' },
  status: { type: String, enum: ['new', 'contacted', 'interested', 'ready_to_convert', 'converted', 'lost'], default: 'new' },
  followUpDate: { type: Date, default: null },
  notes: { type: String, default: '' },
  followUpHistory: [followUpSchema],
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // counsellor
  convertedStudent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  convertedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);