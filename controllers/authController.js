const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'vande_secret_key';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const signToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

function getRoleRedirect(role) {
  const redirectMap = {
    admin: '/admin/dashboard',
    teacher: '/teacher/dashboard',
    counsellor: '/counsellor/dashboard',
    student: '/student/dashboard',
  };

  return redirectMap[role] || '/';
}

const setCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// GET /auth/login
exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login — Vande Digital Academy', error: null });
};

// POST /auth/login
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  console.log('🔑 Login attempt:', { email });
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || (!user.isActive && user.status !== 'complete')) {
      console.log('⚠️ Login failed (User not found or inactive):', { email });
      return res.render('auth/login', { title: 'Login', error: 'Invalid credentials' });
    }

    const match = await user.matchPassword(password);
    if (!match) {
      console.log('⚠️ Login failed (Password incorrect):', { email });
      return res.render('auth/login', { title: 'Login', error: 'Invalid credentials' });
    }

    const token = signToken(user._id);
    setCookie(res, token);

    // Record last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    console.log('✅ User logged in successfully:', { userId: user._id, email: user.email, role: user.role });

    if (user.mustChangePassword || user.firstLoginCompleted === false) {
      return res.redirect('/auth/force-change-password');
    }

    res.redirect(getRoleRedirect(user.role));
  } catch (err) {
    console.error('❌ Login error:', err);
    res.render('auth/login', { title: 'Login', error: 'Something went wrong' });
  }
};

// GET /auth/forgot-password
exports.getForgotPassword = (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password — Vande Digital Academy', error: null });
};

// GET /auth/admin-recovery
exports.getAdminRecovery = (req, res) => {
  res.render('auth/admin-recovery', {
    title: 'Admin Recovery',
    error: null,
    success: null
  });
};

// POST /auth/admin-recovery
exports.postAdminRecovery = async (req, res) => {
  const { email, recoveryKey, newPassword, confirmPassword } = req.body;
  const recoveryEnabled = process.env.ALLOW_ADMIN_RECOVERY === 'true';
  const configuredKey = process.env.ADMIN_RECOVERY_KEY;

  const renderRecovery = (error, success = null) => res.status(error ? 400 : 200).render('auth/admin-recovery', {
    title: 'Admin Recovery',
    error,
    success
  });

  try {
    if (!recoveryEnabled || !configuredKey) {
      logger.warn('Blocked admin recovery attempt because recovery is disabled', {
        email,
        ip: req.ip
      });
      return renderRecovery('Admin recovery is disabled on this server.');
    }

    if (!email || !recoveryKey || !newPassword || !confirmPassword) {
      return renderRecovery('Please fill all recovery fields.');
    }

    if (newPassword.trim().length < 8) {
      return renderRecovery('New password must be at least 8 characters long.');
    }

    if (newPassword !== confirmPassword) {
      return renderRecovery('New password and confirmation do not match.');
    }

    if (recoveryKey.trim() !== configuredKey.trim()) {
      logger.warn('Invalid admin recovery key attempt', {
        email,
        ip: req.ip
      });
      return renderRecovery('Invalid recovery details.');
    }

    const admin = await User.findOne({
      email: email.toLowerCase().trim(),
      role: 'admin',
      isActive: true
    });

    if (!admin) {
      logger.warn('Admin recovery attempted for unknown or inactive admin', {
        email,
        ip: req.ip
      });
      return renderRecovery('Invalid recovery details.');
    }

    admin.password = newPassword.trim();
    admin.mustChangePassword = false;
    admin.passwordSetByAdmin = false;
    admin.firstLoginCompleted = true;
    admin.resetRequested = false;
    admin.passwordChangedAt = new Date();
    admin.tokenBlacklistedBefore = new Date();
    await admin.save();

    res.clearCookie('token');

    logger.warn('Admin password recovered using recovery key', {
      adminId: admin._id,
      email: admin.email,
      ip: req.ip
    });

    return renderRecovery(null, 'Admin password reset successfully. Please sign in with the new password.');
  } catch (err) {
    logger.error('Admin recovery failed', { error: err.message, email, ip: req.ip });
    return renderRecovery('Unable to recover admin password. Please try again.');
  }
};

// POST /auth/forgot-password
exports.postForgotPassword = async (req, res) => {
  const { email, phone } = req.body;
  console.log('🔒 Password reset requested:', { email, phone });
  try {
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      phone: phone.trim()
    });

    if (!user) {
      console.log('⚠️ Password reset request failed (User mismatch):', { email, phone });
      return res.render('auth/forgot-password', {
        title: 'Forgot Password',
        error: 'No user matches the provided email and phone number.'
      });
    }

    if (user.role === 'admin') {
      const activeAdminCount = await User.countDocuments({
        role: 'admin',
        status: 'active',
        isActive: true
      });

      if (activeAdminCount <= 1) {
        return res.render('auth/forgot-password', {
          title: 'Forgot Password',
          error: 'Only one admin exists. Use Admin Recovery with the server recovery key.'
        });
      }
    }

    user.resetRequested = true;
    await user.save();

    console.log('✅ Password reset request logged successfully:', { userId: user._id, rollNumber: user.rollNumber });
    res.redirect('/auth/login?pwd_request=1');
  } catch (err) {
    console.error('❌ Forgot password request error:', err);
    res.render('auth/forgot-password', {
      title: 'Forgot Password',
      error: 'An error occurred. Please try again.'
    });
  }
};

// GET /auth/logout
exports.logout = (req, res) => {
  res.clearCookie('token');
  res.redirect('/auth/login');
};

// GET /auth/force-change-password
exports.getForceChangePassword = (req, res) => {
  if (!req.user.mustChangePassword && req.user.firstLoginCompleted !== false) {
    return res.redirect(getRoleRedirect(req.user.role));
  }

  res.render('auth/force-change-password', {
    title: 'Set New Password',
    user: req.user,
    error: null
  });
};

// POST /auth/force-change-password
exports.postForceChangePassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const renderForcePasswordError = (message) => res.status(400).render('auth/force-change-password', {
    title: 'Set New Password',
    user: req.user,
    error: message
  });

  try {
    const password = String(newPassword || '').trim();
    const confirmation = String(confirmPassword || '').trim();

    if (!password || password.length < 8) {
      return renderForcePasswordError('Password must be at least 8 characters long.');
    }

    if (password !== confirmation) {
      return renderForcePasswordError('New password and confirmation do not match.');
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return renderForcePasswordError('Session user could not be found. Please log in again.');
    }

    const sameAsCurrent = await user.matchPassword(password);

    if (sameAsCurrent) {
      return renderForcePasswordError('Please choose a password different from the temporary or initial password.');
    }

    user.password = password;
    user.mustChangePassword = false;
    user.passwordSetByAdmin = false;
    user.firstLoginCompleted = true;
    user.resetRequested = false;
    user.passwordChangedAt = new Date(Date.now() - 1000);

    await user.save();

    setCookie(res, signToken(user._id));
    res.redirect(`${getRoleRedirect(user.role)}?pwd_changed=1`);
  } catch (err) {
    console.error('Force password change error:', err);
    renderForcePasswordError('Unable to update password. Please try again.');
  }
};

async function getRoleProfile(user) {
  if (!user || !user.role) return null;

  if (user.role === 'student') {
    return Student.findOne({ user: user._id })
      .populate('course', 'name code')
      .populate('batch', 'name')
      .populate({ path: 'teacher', populate: { path: 'user', select: 'name email phone profilePic' } })
      .populate({ path: 'counsellor', populate: { path: 'user', select: 'name email phone profilePic' } });
  }

  if (user.role === 'teacher') {
    const Teacher = require('../models/Teacher');
    return Teacher.findOne({ user: user._id }).populate('courses', 'name code');
  }

  if (user.role === 'counsellor') {
    const Counsellor = require('../models/Counsellor');
    return Counsellor.findOne({ user: user._id });
  }

  return null;
}

// GET /auth/profile
exports.getProfile = async (req, res) => {
  const roleProfile = await getRoleProfile(req.user);
  if (req.query.updated || req.query.saved || req.query.request_submitted) {
    res.locals.success = [];
  }
  if (req.query.error) {
    res.locals.error = [];
  }
  res.render('auth/profile', { title: 'My Profile', user: req.user, roleProfile, query: req.query });
};

// POST /auth/profile
exports.updateProfile = async (req, res) => {
  const { name, phone, fatherName, fatherPhone, motherName, motherPhone, guardianName, guardianRelation, guardianPhone, dob, address, city, removeProfilePic } = req.body;
  console.log('👤 Profile update request:', { userId: req.user._id, role: req.user.role, name, phone, hasFile: !!req.file });

  if (phone && !/^\d{10}$/.test(phone.trim())) {
    const roleProfile = await getRoleProfile(req.user);
    return res.render('auth/profile', { title: 'My Profile', user: req.user, roleProfile, query: req.query, error: 'Phone number must be exactly 10 digits' });
  }
  if (req.user.role === 'student' && guardianPhone && !/^\d{10}$/.test(guardianPhone.trim())) {
    const roleProfile = await getRoleProfile(req.user);
    return res.render('auth/profile', { title: 'My Profile', user: req.user, roleProfile, query: req.query, error: 'Guardian phone number must be exactly 10 digits' });
  }
  if (req.user.role === 'student' && fatherPhone && !/^\d{10}$/.test(fatherPhone.trim())) {
    const roleProfile = await getRoleProfile(req.user);
    return res.render('auth/profile', { title: 'My Profile', user: req.user, roleProfile, query: req.query, error: 'Father phone number must be exactly 10 digits' });
  }
  if (req.user.role === 'student' && motherPhone && !/^\d{10}$/.test(motherPhone.trim())) {
    const roleProfile = await getRoleProfile(req.user);
    return res.render('auth/profile', { title: 'My Profile', user: req.user, roleProfile, query: req.query, error: 'Mother phone number must be exactly 10 digits' });
  }

  try {
    if (req.user.role === 'student') {
      const updateRequest = {
        name: name ? name.trim() : '',
        phone: phone ? phone.trim() : '',
        fatherName: fatherName ? fatherName.trim() : '',
        fatherPhone: fatherPhone ? fatherPhone.trim() : '',
        motherName: motherName ? motherName.trim() : '',
        motherPhone: motherPhone ? motherPhone.trim() : '',
        guardianName: guardianName ? guardianName.trim() : '',
        guardianRelation: guardianRelation ? guardianRelation.trim() : '',
        guardianPhone: guardianPhone ? guardianPhone.trim() : '',
        address: address ? address.trim() : '',
        city: city ? city.trim() : '',
        dob: dob ? new Date(dob) : null,
        requestedAt: new Date()
      };
      if (removeProfilePic === '1') {
        updateRequest.profilePic = '';
      } else if (req.file) {
        updateRequest.profilePic = `/files/${req.file.filename}`;
      }
      await Student.findOneAndUpdate({ user: req.user._id }, {
        pendingProfileUpdate: updateRequest
      });
      console.log('✅ Profile update request submitted by student:', { userId: req.user._id });
      return res.redirect('/auth/profile?request_submitted=1');
    }

    // Staff roles update immediately
    const update = {
      name: name ? name.trim() : '',
      phone: phone ? phone.trim() : '',
      fatherName: fatherName ? fatherName.trim() : '',
      motherName: motherName ? motherName.trim() : '',
      address: address ? address.trim() : '',
      city: city ? city.trim() : '',
      dob: dob ? new Date(dob) : null
    };
    if (removeProfilePic === '1') {
      update.profilePic = null;
    } else if (req.file) {
      update.profilePic = `/files/${req.file.filename}`;
    }

    await User.findByIdAndUpdate(req.user._id, update);
    console.log('✅ Profile updated immediately by staff:', { userId: req.user._id });
    res.redirect('/auth/profile?updated=1');
  } catch (err) {
    console.error('❌ Profile update error:', err);
    const roleProfile = await getRoleProfile(req.user);
    res.render('auth/profile', { title: 'My Profile', user: req.user, roleProfile, query: req.query, error: 'Update failed' });
  }
};

// POST /auth/change-password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  console.log('🔑 Password change request:', { userId: req.user._id });
  try {
    if (!newPassword || newPassword.trim().length < 8) {
      console.log('⚠️ Password change failed (New password too short):', { userId: req.user._id });
      return res.redirect('/auth/profile?error=password_too_short');
    }

    const user = await User.findById(req.user._id);
    const match = await user.matchPassword(currentPassword);
    if (!match) {
      console.log('⚠️ Password change failed (Current password incorrect):', { userId: req.user._id });
      return res.redirect('/auth/profile?error=wrong_password');
    }

    user.password = newPassword.trim();
    user.mustChangePassword = false;
    user.passwordSetByAdmin = false;
    user.firstLoginCompleted = true;
    user.passwordChangedAt = new Date(Date.now() - 1000);
    await user.save(); // triggers bcrypt pre-save hook
    setCookie(res, signToken(user._id));
    console.log('✅ Password changed successfully:', { userId: req.user._id });
    res.redirect('/auth/profile?updated=1');
  } catch (err) {
    console.error('❌ Password change error:', err);
    res.redirect('/auth/profile?error=update_failed');
  }
};

// GET /auth/inbox
exports.getInbox = async (req, res) => {
  try {
    const Message = require('../models/Message');

    // Fetch all unique participants current user has chatted with
    const allUserMessages = await Message.find({
      $or: [{ sender: req.user._id }, { recipient: req.user._id }]
    }).sort({ createdAt: 1 });

    const participantIds = new Set();
    const lastMessageMap = {};

    allUserMessages.forEach(m => {
      const senderId = m.sender.toString();
      const recipientId = m.recipient.toString();
      const otherId = senderId === req.user._id.toString() ? recipientId : senderId;

      participantIds.add(otherId);

      lastMessageMap[otherId] = {
        content: m.content,
        createdAt: m.createdAt,
        senderMe: senderId === req.user._id.toString()
      };
    });

    // Determine default contact list based on user role
    let defaultContacts = [];
    if (req.user.role === 'admin') {
      defaultContacts = await User.find({ _id: { $ne: req.user._id } })
        .select('name role profilePic')
        .sort({ name: 1 });
    } else if (req.user.role === 'teacher') {
      const Schedule = require('../models/Schedule');
      const Teacher = require('../models/Teacher');
      const Counsellor = require('../models/Counsellor');
      const teacherProfile = await Teacher.findOne({ user: req.user._id });
      const assignedBatches = teacherProfile ? await Schedule.distinct('batch', { teacher: teacherProfile._id }) : [];
      const batchStudents = await Student.find({ batch: { $in: assignedBatches } }).select('user counsellor');
      const batchUserIds = batchStudents.map(s => s.user).filter(Boolean);

      const counsellorProfileIds = batchStudents.map(s => s.counsellor).filter(Boolean);
      const counsellors = await Counsellor.find({ _id: { $in: counsellorProfileIds } }).select('user');
      const counsellorUserIds = counsellors.map(c => c.user).filter(Boolean);

      defaultContacts = await User.find({
        _id: { $ne: req.user._id },
        $or: [
          { role: 'admin' },
          { role: 'teacher' },
          { _id: { $in: batchUserIds } },
          { _id: { $in: counsellorUserIds } }
        ]
      })
        .select('name role profilePic')
        .sort({ name: 1 });
    } else if (req.user.role === 'counsellor') {
      const Counsellor = require('../models/Counsellor');
      const Teacher = require('../models/Teacher');
      const counsellorProfile = await Counsellor.findOne({ user: req.user._id });
      const assignedStudents = counsellorProfile ? await Student.find({ counsellor: counsellorProfile._id }).select('user teacher') : [];
      const assignedUserIds = assignedStudents.map(s => s.user).filter(Boolean);

      const teacherProfileIds = assignedStudents.map(s => s.teacher).filter(Boolean);
      const teachers = await Teacher.find({ _id: { $in: teacherProfileIds } }).select('user');
      const teacherUserIds = teachers.map(t => t.user).filter(Boolean);

      defaultContacts = await User.find({
        _id: { $ne: req.user._id },
        $or: [
          { role: 'admin' },
          { role: 'counsellor' },
          { _id: { $in: assignedUserIds } },
          { _id: { $in: teacherUserIds } }
        ]
      })
        .select('name role profilePic')
        .sort({ name: 1 });
    } else if (req.user.role === 'student') {
      const myProfile = await Student.findOne({ user: req.user._id }).select('teacher counsellor');
      const condition = [{ role: 'admin' }];
      if (myProfile?.teacher) {
        const Teacher = require('../models/Teacher');
        const teacherProfile = await Teacher.findById(myProfile.teacher).select('user');
        if (teacherProfile && teacherProfile.user) {
          condition.push({ _id: teacherProfile.user });
        }
      }
      if (myProfile?.counsellor) {
        const Counsellor = require('../models/Counsellor');
        const counsellorProfile = await Counsellor.findById(myProfile.counsellor).select('user');
        if (counsellorProfile && counsellorProfile.user) {
          condition.push({ _id: counsellorProfile.user });
        }
      }
      defaultContacts = await User.find({
        _id: { $ne: req.user._id },
        $or: condition
      })
        .select('name role profilePic')
        .sort({ name: 1 });
    }

    // Merge default contacts and message participants
    const contactMap = new Map();
    defaultContacts.forEach(c => contactMap.set(c._id.toString(), c));

    if (participantIds.size > 0) {
      const extraUsers = await User.find({ _id: { $in: Array.from(participantIds) } })
        .select('name role profilePic');
      extraUsers.forEach(u => {
        if (!contactMap.has(u._id.toString()) && u._id.toString() !== req.user._id.toString()) {
          contactMap.set(u._id.toString(), u);
        }
      });
    }

    // Filter contactMap to ensure strict authorization
    const { validateAndSanitizeMessage } = require('../utils/messageValidator');
    const allowedContacts = [];
    for (const c of contactMap.values()) {
      try {
        await validateAndSanitizeMessage(req.user, c._id.toString(), 'check');
        allowedContacts.push(c);
      } catch (e) {
        // Not authorized, filter out
      }
    }

    // Sort contacts by last message timestamp (latest first)
    const contacts = allowedContacts.map(u => {
      const userObj = u.toObject ? u.toObject() : u;
      const lastMsg = lastMessageMap[u._id.toString()];
      userObj.lastMessageTime = lastMsg ? new Date(lastMsg.createdAt) : new Date(0);
      return userObj;
    }).sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    // Get unread counts grouped by sender
    const unreadCounts = await Message.aggregate([
      { $match: { recipient: req.user._id, read: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } }
    ]);
    const unreadMap = {};
    unreadCounts.forEach(item => {
      unreadMap[item._id.toString()] = item.count;
    });

    // Active Chat Selected
    let selectedContact = null;
    let chatHistory = [];
    const selectedId = req.query.chat || (contacts.length > 0 ? contacts[0]._id.toString() : null);

    if (selectedId) {
      selectedContact = await User.findById(selectedId).select('name role profilePic phone email status');
      if (selectedContact) {
        const Teacher = require('../models/Teacher');
        const Counsellor = require('../models/Counsellor');

        let extraInfo = {};
        if (selectedContact.role === 'student') {
          const studentDoc = await Student.findOne({ user: selectedContact._id })
            .populate('course', 'name')
            .populate('batch', 'name')
            .populate({
              path: 'counsellor',
              populate: { path: 'user', select: 'name' }
            })
            .populate({
              path: 'teacher',
              populate: { path: 'user', select: 'name' }
            });
          if (studentDoc) {
            extraInfo = {
              rollNumber: studentDoc.rollNumber || '',
              course: studentDoc.course ? studentDoc.course.name : '',
              batch: studentDoc.batch ? studentDoc.batch.name : '',
              counsellor: studentDoc.counsellor && studentDoc.counsellor.user ? studentDoc.counsellor.user.name : '',
              teacher: studentDoc.teacher && studentDoc.teacher.user ? studentDoc.teacher.user.name : ''
            };
          }
        } else if (selectedContact.role === 'teacher') {
          const teacherDoc = await Teacher.findOne({ user: selectedContact._id }).populate('courses', 'name');
          if (teacherDoc) {
            extraInfo = {
              rollNumber: teacherDoc.rollNumber || '',
              qualification: teacherDoc.qualification || '',
              experienceYears: teacherDoc.experienceYears || 0,
              courses: teacherDoc.courses ? teacherDoc.courses.map(c => c.name).join(', ') : ''
            };
          }
        } else if (selectedContact.role === 'counsellor') {
          const counsellorDoc = await Counsellor.findOne({ user: selectedContact._id });
          if (counsellorDoc) {
            extraInfo = {
              rollNumber: counsellorDoc.rollNumber || ''
            };
          }
        }

        selectedContact = selectedContact.toObject();
        selectedContact.extraInfo = extraInfo;

        // Load history
        chatHistory = await Message.find({
          $or: [
            { sender: req.user._id, recipient: selectedId },
            { sender: selectedId, recipient: req.user._id }
          ]
        })
          .populate('sender recipient', 'name role profilePic')
          .populate('replyTo')
          .sort({ createdAt: 1 });

        // Find the unread message IDs before marking them read
        const unreadMessagesFromContact = await Message.find({
          sender: selectedId,
          recipient: req.user._id,
          read: false
        }).select('_id');

        const unreadMsgIds = unreadMessagesFromContact.map(m => m._id.toString());

        // Mark received messages from this contact as read
        await Message.updateMany(
          { sender: selectedId, recipient: req.user._id, read: false },
          { $set: { read: true, readAt: new Date() } }
        );

        if (unreadMsgIds.length > 0) {
          // Add these message IDs to the user's readNotifications array
          await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { readNotifications: { $each: unreadMsgIds } }
          });
        }

        // Also remove any notifications corresponding to these messages from res.locals.notifications for immediate render sync
        if (res.locals.notifications) {
          res.locals.notifications = res.locals.notifications.filter(
            n => !(n.type === 'message' && n.senderId === selectedId.toString())
          );
        }

        // Keep sidebar badges in sync
        const unreadFromThisContact = unreadMap[selectedId.toString()] || 0;
        if (res.locals.sidebarBadges) {
          res.locals.sidebarBadges.unreadMessages = Math.max(0, (res.locals.sidebarBadges.unreadMessages || 0) - unreadFromThisContact);
        }

        if (unreadFromThisContact > 0) {
          unreadMap[selectedId.toString()] = 0;
        }
      }
    }

    res.render('auth/inbox', {
      title: 'Inbox & Chat',
      user: req.user,
      contacts,
      selectedContact,
      chatHistory,
      unreadMap,
      lastMessageMap,
      page: 'inbox'
    });
  } catch (err) {
    console.error('❌ getInbox Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

// GET /auth/inbox/messages (AJAX polling helper returning JSON list of messages)
exports.getInboxMessages = async (req, res) => {
  const contactId = req.query.chat;
  if (!contactId) {
    return res.status(400).json({ error: 'Missing chat parameter' });
  }
  try {
    const Message = require('../models/Message');
    const { validateAndSanitizeMessage } = require('../utils/messageValidator');

    // Auth check first
    await validateAndSanitizeMessage(req.user, contactId, 'check');

    const chatHistory = await Message.find({
      $or: [
        { sender: req.user._id, recipient: contactId },
        { sender: contactId, recipient: req.user._id }
      ]
    })
      .populate('sender recipient', 'name role profilePic')
      .populate('replyTo')
      .sort({ createdAt: 1 });

    // Mark received messages from this contact as read
    await Message.updateMany(
      { sender: contactId, recipient: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    res.json({ ok: true, messages: chatHistory });
  } catch (err) {
    console.error('❌ getInboxMessages Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /auth/inbox/send
exports.postInboxSend = async (req, res) => {
  const { recipientId, content, replyTo } = req.body;
  try {
    const Message = require('../models/Message');
    const { validateAndSanitizeMessage } = require('../utils/messageValidator');

    let validateContent = content;
    const hasFiles = req.files && req.files.length > 0;
    if (!validateContent && hasFiles) {
      validateContent = 'attachment_only';
    }

    const { cleanContent } = await validateAndSanitizeMessage(req.user, recipientId, validateContent);

    const attachments = [];
    if (hasFiles) {
      req.files.forEach(f => {
        attachments.push({
          url: `/files/${f.filename}`,
          fileName: f.originalname || '',
          fileType: f.mimetype || '',
          fileSize: f.size || 0
        });
      });
    }

    const newMessage = await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content: cleanContent,
      replyTo: replyTo || null,
      attachments
    });

    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.json({ ok: true, message: newMessage });
    }
    res.redirect(`/auth/inbox?chat=${recipientId}`);
  } catch (err) {
    console.error('❌ postInboxSend Error:', err);
    if (err.message && (err.message.includes('authorized') || err.message.includes('authorized to message'))) {
      return res.status(403).render('403', {
        title: 'Access Restricted',
        user: req.user,
        error: err.message
      });
    }
    res.redirect(`/auth/inbox?error=${encodeURIComponent(err.message)}`);
  }
};

// POST /auth/notifications/:id/read
exports.postReadNotification = async (req, res) => {
  const { id } = req.params;
  console.log('🔔 Marking notification as read:', { userId: req.user._id, notificationId: id });
  try {
    const mongoose = require('mongoose');
    // If it's a valid message ID, mark that message as read
    if (mongoose.Types.ObjectId.isValid(id)) {
      const Message = require('../models/Message');
      await Message.findByIdAndUpdate(id, { read: true, readAt: new Date() });
    }

    // Add to user's readNotifications array
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { readNotifications: id }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ postReadNotification Error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// POST /auth/notifications/read-all
exports.postReadAllNotifications = async (req, res) => {
  const { ids } = req.body;
  console.log('🔔 Marking all notifications as read:', { userId: req.user._id, count: ids?.length });
  try {
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Missing or invalid ids array' });
    }

    const mongoose = require('mongoose');
    const Message = require('../models/Message');

    // Filter valid message ObjectIds
    const messageIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));

    if (messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds }, recipient: req.user._id },
        { $set: { read: true, readAt: new Date() } }
      );
    }

    // Push all notification IDs into the user's readNotifications list
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { readNotifications: { $each: ids } }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ postReadAllNotifications Error:', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

// POST /auth/messages/:id/edit or PUT /auth/messages/:id/edit
exports.editMessage = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  console.log('✏️ Editing message:', { userId: req.user._id, messageId: id });
  try {
    const Message = require('../models/Message');
    const msg = await Message.findById(id);
    if (!msg) {
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(404).json({ error: 'Message not found' });
      }
      return res.status(404).render('404', { title: 'Not Found', user: req.user, layout: 'main' });
    }

    // Authorization: only the sender can edit
    if (msg.sender.toString() !== req.user._id.toString()) {
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(403).json({ error: 'You are not authorized to edit this message.' });
      }
      return res.status(403).render('403', { title: 'Access Restricted', user: req.user, error: 'You are not authorized to edit this message.' });
    }


    // Sanitize content (strip HTML, limit length)
    let cleanContent = (content || '').trim();
    if (cleanContent.length > 2000) {
      cleanContent = cleanContent.substring(0, 2000);
    }
    cleanContent = cleanContent.replace(/<[^>]*>/g, '');

    if (!cleanContent) {
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(400).json({ error: 'Message content cannot be empty.' });
      }
      return res.status(400).render('400', { title: 'Bad Request', user: req.user, error: 'Message content cannot be empty after sanitization.' });
    }

    msg.content = cleanContent;
    await msg.save();

    console.log('✅ Message edited successfully:', { messageId: msg._id });
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.json({ ok: true, message: msg });
    }
    res.redirect(`/auth/inbox?chat=${msg.recipient}`);
  } catch (err) {
    console.error('❌ editMessage Error:', err);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
  }
};

/**
 * POST /auth/inbox/react
 * Handles emoji reactions. Only allows participants to react.
 */
exports.postAddReaction = async (req, res) => {
  const { messageId, emoji } = req.body;
  try {
    const Message = require('../models/Message');
    const msg = await Message.findById(messageId);
    if (!msg) {
      return res.status(404).json({ ok: false, error: 'Message not found' });
    }

    // Auth check: user must be sender or recipient
    const userIdStr = req.user._id.toString();
    if (msg.sender.toString() !== userIdStr && msg.recipient.toString() !== userIdStr) {
      return res.status(403).json({ ok: false, error: 'Access Denied' });
    }

    if (!msg.reactions) {
      msg.reactions = [];
    }

    const existingReactionIndex = msg.reactions.findIndex(r => r.user.toString() === userIdStr);

    if (existingReactionIndex > -1) {
      const existingReaction = msg.reactions[existingReactionIndex];
      if (existingReaction.emoji === emoji) {
        msg.reactions.splice(existingReactionIndex, 1);
      } else {
        existingReaction.emoji = emoji;
      }
    } else {
      msg.reactions.push({
        user: req.user._id,
        emoji
      });
    }

    await msg.save();
    res.json({ ok: true, reactions: msg.reactions });
  } catch (err) {
    console.error('❌ postAddReaction Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// GET /auth/guide
exports.getGuide = async (req, res) => {
  try {
    res.render('auth/guide', {
      title: 'Platform Guide & Policy Manual',
      user: req.user,
      page: 'guide'
    });
  } catch (err) {
    console.error('❌ getGuide Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user });
  }
};

// GET /auth/inbox/user-profile/:id
exports.getContactProfileData = async (req, res) => {
  const contactId = req.params.id;
  try {
    const User = require('../models/User');
    const Student = require('../models/Student');
    const Teacher = require('../models/Teacher');
    const Counsellor = require('../models/Counsellor');
    const Course = require('../models/Course');
    const Batch = require('../models/Batch');

    const { validateAndSanitizeMessage } = require('../utils/messageValidator');
    await validateAndSanitizeMessage(req.user, contactId, 'check');

    const contact = await User.findById(contactId).select('name role profilePic phone email status');
    if (!contact) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let extraInfo = {};
    if (contact.role === 'student') {
      const studentDoc = await Student.findOne({ user: contact._id })
        .populate('course', 'name')
        .populate('batch', 'name')
        .populate({
          path: 'counsellor',
          populate: { path: 'user', select: 'name' }
        })
        .populate({
          path: 'teacher',
          populate: { path: 'user', select: 'name' }
        });
      if (studentDoc) {
        extraInfo = {
          rollNumber: studentDoc.rollNumber || '',
          course: studentDoc.course ? studentDoc.course.name : '',
          batch: studentDoc.batch ? studentDoc.batch.name : '',
          counsellor: studentDoc.counsellor && studentDoc.counsellor.user ? studentDoc.counsellor.user.name : '',
          teacher: studentDoc.teacher && studentDoc.teacher.user ? studentDoc.teacher.user.name : ''
        };
      }
    } else if (contact.role === 'teacher') {
      const teacherDoc = await Teacher.findOne({ user: contact._id }).populate('courses', 'name');
      if (teacherDoc) {
        extraInfo = {
          rollNumber: teacherDoc.rollNumber || '',
          qualification: teacherDoc.qualification || '',
          experienceYears: teacherDoc.experienceYears || 0,
          courses: teacherDoc.courses ? teacherDoc.courses.map(c => c.name).join(', ') : ''
        };
      }
    } else if (contact.role === 'counsellor') {
      const counsellorDoc = await Counsellor.findOne({ user: contact._id });
      if (counsellorDoc) {
        extraInfo = {
          rollNumber: counsellorDoc.rollNumber || ''
        };
      }
    }

    res.json({
      success: true,
      data: {
        name: contact.name,
        role: contact.role,
        profilePic: contact.profilePic || '',
        email: contact.email || '',
        phone: contact.phone || '',
        status: contact.status || 'active',
        extraInfo
      }
    });
  } catch (err) {
    console.error('❌ getContactProfileData Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

// POST /auth/announcements/:id/read
exports.postReadAnnouncement = async (req, res) => {
  try {
    const Announcement = require('../models/Announcement');
    await Announcement.updateOne(
      {
        _id: req.params.id,
        'readBy.user': { $ne: req.user._id }
      },
      {
        $push: {
          readBy: {
            user: req.user._id,
            readAt: new Date()
          }
        }
      }
    );

    res.redirect(req.header('Referer') || getRoleRedirect(req.user.role));
  } catch (err) {
    console.error('Failed to mark announcement read:', err);
    res.redirect(req.header('Referer') || getRoleRedirect(req.user.role));
  }
};
