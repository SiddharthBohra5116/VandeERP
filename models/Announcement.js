const mongoose = require("mongoose");
const { ANNOUNCEMENT_AUDIENCE, ANNOUNCEMENT_ROLES } = require('../config/constants');

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  fileName: { type: String, default: "" },
  fileType: { type: String, default: "" },
  fileSize: { type: Number, default: 0 }
}, { _id: false });

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, trim: true, default: "" },
  attachments: [attachmentSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  audienceType: { type: String, enum: ANNOUNCEMENT_AUDIENCE, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", default: null },
  role: { type: String, enum: ANNOUNCEMENT_ROLES, default: "" },
  counsellor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    readAt: { type: Date, default: Date.now }
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

announcementSchema.pre("validate", function (next) {
  const hasText = this.content && this.content.trim().length > 0;
  const hasAttachments = this.attachments && this.attachments.length > 0;

  if (!hasText && !hasAttachments) {
    this.invalidate("content", "Announcement must contain text or at least one attachment.");
  }
  next();
});

announcementSchema.index({ audienceType: 1, createdAt: -1 });
announcementSchema.index({ course: 1, createdAt: -1 });
announcementSchema.index({ batch: 1, createdAt: -1 });
announcementSchema.index({ role: 1, createdAt: -1 });
announcementSchema.index({ counsellor: 1, createdAt: -1 });

module.exports = mongoose.model("Announcement", announcementSchema);
