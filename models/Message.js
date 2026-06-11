const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  fileName: { type: String, default: '' },
  fileType: { type: String, default: '' },
  fileSize: { type: Number, default: 0 }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
<<<<<<< HEAD

  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },

  content: { type: String, trim: true, default: '' },
  attachments: [attachmentSchema],

  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },

  editableUntil: { type: Date },

=======
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  content: { type: String, trim: true, default: '' },
  attachments: [attachmentSchema],
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  editableUntil: { type: Date },
>>>>>>> origin/main
  isDeletedBySender: { type: Boolean, default: false },
  isDeletedByRecipient: { type: Boolean, default: false }
}, { timestamps: true });

messageSchema.pre('validate', function(next) {
  const hasText = this.content && this.content.trim().length > 0;
  const hasAttachments = this.attachments && this.attachments.length > 0;
<<<<<<< HEAD

  if (!hasText && !hasAttachments) {
    this.invalidate('content', 'Message must contain text or at least one attachment.');
  }

=======
  if (!hasText && !hasAttachments) {
    this.invalidate('content', 'Message must contain text or at least one attachment.');
  }
>>>>>>> origin/main
  next();
});

messageSchema.pre('save', function(next) {
  if (this.isNew) {
    const creationTime = this.createdAt || new Date();
    this.editableUntil = new Date(creationTime.getTime() + 10 * 60 * 1000);
  }
<<<<<<< HEAD

=======
>>>>>>> origin/main
  next();
});

messageSchema.index({ recipient: 1, read: 1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ replyTo: 1 });

module.exports = mongoose.model('Message', messageSchema);