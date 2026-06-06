const User = require('../models/User');

async function validateAndSanitizeMessage(sender, recipientId, content) {
  if (!recipientId) {
    throw new Error('Recipient ID is required');
  }

  // 1. Verify recipient exists
  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new Error('Recipient not found');
  }

  // 2. Restrict student messaging: students may only message their assigned teacher, counsellor, or an admin
  if (sender.role === 'student') {
    const isAssignedTeacher = sender.teacher && sender.teacher.toString() === recipientId.toString();
    const isAssignedCounsellor = sender.counsellor && sender.counsellor.toString() === recipientId.toString();
    const isAdmin = recipient.role === 'admin';
    
    if (!isAssignedTeacher && !isAssignedCounsellor && !isAdmin) {
      throw new Error('Students are only authorized to message their assigned teacher, counsellor, or an administrator.');
    }
  }

  // 3. Add a content length limit (max 2000 characters)
  let cleanContent = (content || '').trim();
  if (cleanContent.length > 2000) {
    cleanContent = cleanContent.substring(0, 2000);
  }

  // 4. Strip HTML tags from the content field to prevent stored XSS
  cleanContent = cleanContent.replace(/<[^>]*>/g, '');

  if (!cleanContent) {
    throw new Error('Message content cannot be empty after sanitization.');
  }

  return { recipient, cleanContent };
}

module.exports = {
  validateAndSanitizeMessage
};
