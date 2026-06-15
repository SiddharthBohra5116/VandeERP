const mongoose = require('mongoose');

const revenueTargetSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true },
  amount: { type: Number, required: true, min: 0 },
  note: { type: String, default: '' },
  setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('RevenueTarget', revenueTargetSchema);