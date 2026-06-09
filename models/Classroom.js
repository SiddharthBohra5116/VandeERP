const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  capacity: { type: Number, default: 0 },
  location: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Classroom', classroomSchema);
