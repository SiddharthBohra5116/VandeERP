const mongoose = require('mongoose');

const moduleSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'academy-modules' },
  modules: {
    students: { type: Boolean, default: true },
    teachers: { type: Boolean, default: true },
    counsellors: { type: Boolean, default: true },
    courses: { type: Boolean, default: true },
    batches: { type: Boolean, default: true },
    attendance: { type: Boolean, default: true },
    kyc: { type: Boolean, default: true },
    leads: { type: Boolean, default: true },
    fees: { type: Boolean, default: true },
    schedules: { type: Boolean, default: true },
    assignments: { type: Boolean, default: true },
    updates: { type: Boolean, default: true },
    curriculum: { type: Boolean, default: true },
    progress: { type: Boolean, default: true },
    announcements: { type: Boolean, default: true },
    reports: { type: Boolean, default: true },
    leaves: { type: Boolean, default: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('ModuleSettings', moduleSettingsSchema);
