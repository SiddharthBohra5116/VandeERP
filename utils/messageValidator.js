const User = require('../models/User');
const Student = require('../models/Student');
const Schedule = require('../models/Schedule');
const Teacher = require('../models/Teacher');
const Counsellor = require('../models/Counsellor');

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

  // Everyone can message an Admin
  if (recipient.role === 'admin') {
    return sanitizeMessage(recipient, content);
  }

  // Student constraints
  if (sender.role === 'student') {
    const studentProfile = await Student.findOne({ user: sender._id });
    if (!studentProfile) {
      throw new Error('Student profile not found.');
    }

    let isAssignedTeacher = false;
    if (studentProfile.teacher) {
      const teacherProfile = await Teacher.findById(studentProfile.teacher);
      if (teacherProfile && teacherProfile.user && teacherProfile.user.toString() === recipientId.toString()) {
        isAssignedTeacher = true;
      }
    }

    let isAssignedCounsellor = false;
    if (studentProfile.counsellor) {
      const counsellorProfile = await Counsellor.findById(studentProfile.counsellor);
      if (counsellorProfile && counsellorProfile.user && counsellorProfile.user.toString() === recipientId.toString()) {
        isAssignedCounsellor = true;
      }
    }

    if (!isAssignedTeacher && !isAssignedCounsellor) {
      throw new Error('Students are only authorized to message their assigned teacher, assigned counsellor, or an administrator.');
    }
  }

  // Teacher constraints
  else if (sender.role === 'teacher') {
    // Can message other teachers
    if (recipient.role === 'teacher') {
      return sanitizeMessage(recipient, content);
    }

    const teacherProfile = await Teacher.findOne({ user: sender._id });
    if (!teacherProfile) {
      throw new Error('Teacher profile not found.');
    }

    const assignedBatches = await Schedule.distinct('batch', { teacher: teacherProfile._id });

    // Can message students in their batches
    if (recipient.role === 'student') {
      const recipientStudent = await Student.findOne({ user: recipient._id });
      const isAssignedStudent = recipientStudent && recipientStudent.batch && 
                                assignedBatches.some(bId => bId.toString() === recipientStudent.batch.toString());
      if (!isAssignedStudent) {
        throw new Error('Teachers are only authorized to message students in their assigned batches, other teachers, relevant counsellors, or an administrator.');
      }
    } 
    // Can message counsellors related to their students
    else if (recipient.role === 'counsellor') {
      const batchStudents = await Student.find({ batch: { $in: assignedBatches } });
      const counsellorProfileIds = batchStudents.map(s => s.counsellor).filter(Boolean);
      
      const counsellorProfile = await Counsellor.findOne({ user: recipient._id, _id: { $in: counsellorProfileIds } });
      if (!counsellorProfile) {
        throw new Error('Teachers are only authorized to message counsellors associated with their students.');
      }
    } else {
      throw new Error('Unauthorized recipient role.');
    }
  }

  // Counsellor constraints
  else if (sender.role === 'counsellor') {
    // Can message other counsellors
    if (recipient.role === 'counsellor') {
      return sanitizeMessage(recipient, content);
    }

    const counsellorProfile = await Counsellor.findOne({ user: sender._id });
    if (!counsellorProfile) {
      throw new Error('Counsellor profile not found.');
    }

    // Can message assigned students
    if (recipient.role === 'student') {
      const isAssignedStudent = await Student.findOne({ user: recipient._id, counsellor: counsellorProfile._id });
      if (!isAssignedStudent) {
        throw new Error('Counsellors are only authorized to message their assigned students, other counsellors, relevant teachers, or an administrator.');
      }
    } 
    // Can message teachers of their students
    else if (recipient.role === 'teacher') {
      const assignedStudents = await Student.find({ counsellor: counsellorProfile._id });
      const teacherProfileIds = assignedStudents.map(s => s.teacher).filter(Boolean);
      
      const teacherProfile = await Teacher.findOne({ user: recipient._id, _id: { $in: teacherProfileIds } });
      if (!teacherProfile) {
        throw new Error('Counsellors are only authorized to message teachers associated with their students.');
      }
    } else {
      throw new Error('Unauthorized recipient role.');
    }
  }

  return sanitizeMessage(recipient, content);
}

function sanitizeMessage(recipient, content) {
  let cleanContent = (content || '').trim();

  if (cleanContent.length > 2000) {
    cleanContent = cleanContent.substring(0, 2000);
  }

  // If content is 'attachment_only', bypass the empty check.
  if (cleanContent === 'attachment_only') {
    cleanContent = '';
  } else {
    cleanContent = cleanContent.replace(/<[^>]*>/g, '');
  }

  // In check mode (like contact list building), allow empty content
  if (content !== 'check' && content !== 'attachment_only' && !cleanContent) {
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