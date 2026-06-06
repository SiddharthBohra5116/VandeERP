const mongoose = require('mongoose');

const dailyUpdateSchema = new mongoose.Schema({
  title: { type: String, trim: true, default: '' },
  subject: { type: String, required: true },
  batch: { type: String, required: true },
  content: { type: String, default: '' },
  homework: { type: String, default: '' }, // Matches HTML form name
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileUrl: { type: String, default: null },   // optional resource/notes file
  fileName: { type: String, default: null },
  date: { type: String, required: true },     // YYYY-MM-DD
  topics: [{ type: String }],                 // array of topic tags
}, { timestamps: true });

module.exports = mongoose.model('DailyUpdate', dailyUpdateSchema);