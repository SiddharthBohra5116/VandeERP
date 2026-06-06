const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD format
}, { timestamps: true });

module.exports = mongoose.model('Holiday', holidaySchema);
