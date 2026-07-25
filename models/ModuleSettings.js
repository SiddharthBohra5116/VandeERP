const mongoose = require('mongoose');

const moduleSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'academy-modules' },
  modules: {
    students: { type: Boolean, default: true },
    teachers: { type: Boolean, default: true },
    batches: { type: Boolean, default: true },
    attendance: { type: Boolean, default: true },
    kyc: { type: Boolean, default: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('ModuleSettings', moduleSettingsSchema);
