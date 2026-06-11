const User = require('../models/User');
const Student = require('../models/Student');
const Schedule = require('../models/Schedule');

async function validateAndSanitizeMessage(sender, recipientId, content) {
  if (!recipientId) {
    throw new Error('Recipient ID is required');
  }

  const recipient = await User.findById(recipientId);

  if (!recipient) {
    throw new Error('Recipient not found');
  }

  // Admin can message anyone
  if (sender.role === 'admin') {
    return sanitizeMessage(recipient, content);
  }

  // Student can message admin, assigned teacher, assigned counsellor
  if (sender.role === 'student') {
    const studentProfile = await Student.findOne({
      userId: sender._id
    });

    const isAdmin = recipient.role === 'admin';

    const isAssignedTeacher =
      studentProfile &&
      studentProfile.teacher &&
      studentProfile.teacher.toString() === recipientId.toString();

    const isAssignedCounsellor =
      studentProfile &&
      studentProfile.counsellor &&
      studentProfile.counsellor.toString() === recipientId.toString();

    if (!isAdmin && !isAssignedTeacher && !isAssignedCounsellor) {
      throw new Error(
        'Students are only authorized to message their assigned teacher, assigned counsellor, or an administrator.'
      );
    }
  }

  // Teacher can message admin and students in assigned batches
  else if (sender.role === 'teacher') {
    const isAdmin = recipient.role === 'admin';

    let isAssignedStudent = false;

    if (recipient.role === 'student') {
      const recipientStudent = await Student.findOne({
        userId: recipient._id
      });

      if (recipientStudent && recipientStudent.batch) {
        const assignedBatches = await Schedule.distinct('batch', {
          teacher: sender._id
        });

        isAssignedStudent = assignedBatches.some(batchId =>
          batchId.toString() === recipientStudent.batch.toString()
        );
      }
    }

    if (!isAdmin && !isAssignedStudent) {
      throw new Error(
        'Teachers are only authorized to message students in their assigned batches or an administrator.'
      );
    }
  }

  // Counsellor can message admin and their assigned students
  else if (sender.role === 'counsellor') {
    const isAdmin = recipient.role === 'admin';

    let isAssignedStudent = false;

    if (recipient.role === 'student') {
      const recipientStudent = await Student.findOne({
        userId: recipient._id
      });

      isAssignedStudent =
        recipientStudent &&
        recipientStudent.counsellor &&
        recipientStudent.counsellor.toString() === sender._id.toString();
    }

    if (!isAdmin && !isAssignedStudent) {
      throw new Error(
        'Counsellors are only authorized to message their assigned students or an administrator.'
      );
    }
  }

  return sanitizeMessage(recipient, content);
}

function sanitizeMessage(recipient, content) {
  let cleanContent = (content || '').trim();

  if (cleanContent.length > 2000) {
    cleanContent = cleanContent.substring(0, 2000);
  }

  cleanContent = cleanContent.replace(/<[^>]*>/g, '');

  if (!cleanContent) {
    throw new Error('Message content cannot be empty after sanitization.');
  }

  return {
    recipient,
    cleanContent
  };
}

module.exports = {
  validateAndSanitizeMessage
};