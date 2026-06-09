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

  // 2. Role-based messaging restrictions
  if (sender.role === 'student') {
    // Students can see/message ONLY their assigned teacher and admin
    const isAssignedTeacher = sender.teacher && sender.teacher.toString() === recipientId.toString();
    const isAdmin = recipient.role === 'admin';
    if (!isAssignedTeacher && !isAdmin) {
      throw new Error('Students are only authorized to message their assigned teacher or an administrator.');
    }
  } else if (sender.role === 'teacher') {
    // Teachers can see/message ONLY students in their assigned batches, and admin
    const isAdmin = recipient.role === 'admin';
    let isAssignedStudent = false;
    if (recipient.role === 'student' && recipient.batch) {
      const Schedule = require('../models/Schedule');
      const assignedBatches = await Schedule.distinct('batch', { teacher: sender._id });
      isAssignedStudent = assignedBatches.includes(recipient.batch);
    }
    if (!isAdmin && !isAssignedStudent) {
      throw new Error('Teachers are only authorized to message students in their assigned batches or an administrator.');
    }
  } else if (sender.role === 'counsellor') {
    // Counsellors can see/message ONLY students they converted/are assigned to, and admin
    const isAdmin = recipient.role === 'admin';
    const isAssignedStudent = recipient.role === 'student' && recipient.counsellor && recipient.counsellor.toString() === sender._id.toString();
    if (!isAdmin && !isAssignedStudent) {
      throw new Error('Counsellors are only authorized to message their assigned students or an administrator.');
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
