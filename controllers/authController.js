const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'vande_secret_key';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const signToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

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

    const redirectMap = {
      admin: '/admin/dashboard',
      teacher: '/teacher/dashboard',
      counsellor: '/counsellor/dashboard',
      student: '/student/dashboard',
    };
    res.redirect(redirectMap[user.role] || '/');
  } catch (err) {
    console.error('❌ Login error:', err);
    res.render('auth/login', { title: 'Login', error: 'Something went wrong' });
  }
};

// GET /auth/forgot-password
exports.getForgotPassword = (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password — Vande Digital Academy', error: null });
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

// GET /auth/profile
exports.getProfile = async (req, res) => {
  res.render('auth/profile', { title: 'My Profile', user: req.user });
};

// POST /auth/profile
exports.updateProfile = async (req, res) => {
  const { name, phone, fatherName, motherName, dob, address, city } = req.body;
  console.log('👤 Profile update request:', { userId: req.user._id, role: req.user.role, name, phone, hasFile: !!req.file });
  try {
    if (req.user.role === 'student') {
      const updateRequest = {
        name: name ? name.trim() : '',
        phone: phone ? phone.trim() : '',
        fatherName: fatherName ? fatherName.trim() : '',
        motherName: motherName ? motherName.trim() : '',
        address: address ? address.trim() : '',
        city: city ? city.trim() : '',
        dob: dob ? new Date(dob) : null,
        requestedAt: new Date()
      };
      if (req.file) {
        updateRequest.profilePic = `/files/${req.file.filename}`;
      }
      await User.findByIdAndUpdate(req.user._id, {
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
    if (req.file) update.profilePic = `/files/${req.file.filename}`;

    await User.findByIdAndUpdate(req.user._id, update);
    console.log('✅ Profile updated immediately by staff:', { userId: req.user._id });
    res.redirect('/auth/profile?updated=1');
  } catch (err) {
    console.error('❌ Profile update error:', err);
    res.render('auth/profile', { title: 'My Profile', user: req.user, error: 'Update failed' });
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
    await user.save(); // triggers bcrypt pre-save hook
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
        .select('name role profilePic rollNumber')
        .sort({ name: 1 });
    } else if (req.user.role === 'teacher') {
      const Schedule = require('../models/Schedule');
      const assignedBatches = await Schedule.distinct('batch', { teacher: req.user._id });
      defaultContacts = await User.find({
        _id: { $ne: req.user._id },
        $or: [
          { role: 'admin' },
          { role: 'student', batch: { $in: assignedBatches }, status: { $in: ['active', 'complete'] } }
        ]
      })
        .select('name role profilePic rollNumber')
        .sort({ name: 1 });
    } else if (req.user.role === 'counsellor') {
      defaultContacts = await User.find({
        _id: { $ne: req.user._id },
        $or: [
          { role: 'admin' },
          { role: 'student', counsellor: req.user._id, status: { $in: ['active', 'complete'] } }
        ]
      })
        .select('name role profilePic rollNumber')
        .sort({ name: 1 });
    } else if (req.user.role === 'student') {
      const condition = [{ role: 'admin' }];
      if (req.user.teacher) {
        condition.push({ _id: req.user.teacher });
      }
      defaultContacts = await User.find({
        _id: { $ne: req.user._id },
        $or: condition
      })
        .select('name role profilePic rollNumber')
        .sort({ name: 1 });
    }

    // Merge default contacts and message participants
    const contactMap = new Map();
    defaultContacts.forEach(c => contactMap.set(c._id.toString(), c));

    if (participantIds.size > 0) {
      const extraUsers = await User.find({ _id: { $in: Array.from(participantIds) } })
        .select('name role profilePic rollNumber');
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
      selectedContact = await User.findById(selectedId).select('name role profilePic rollNumber');
      if (selectedContact) {
        // Load history
        chatHistory = await Message.find({
          $or: [
            { sender: req.user._id, recipient: selectedId },
            { sender: selectedId, recipient: req.user._id }
          ]
        })
          .populate('sender recipient', 'name role profilePic')
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

// POST /auth/inbox/send
exports.postInboxSend = async (req, res) => {
  const { recipientId, content } = req.body;
  try {
    const Message = require('../models/Message');
    const { validateAndSanitizeMessage } = require('../utils/messageValidator');
    const { cleanContent } = await validateAndSanitizeMessage(req.user, recipientId, content);

    await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content: cleanContent
    });

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
      return res.status(404).render('404', { title: 'Not Found', user: req.user, layout: 'main' });
    }

    // Authorization: only the sender can edit
    if (msg.sender.toString() !== req.user._id.toString()) {
      return res.status(403).render('403', { title: 'Access Restricted', user: req.user, error: 'You are not authorized to edit this message.' });
    }

    // Constraints: must be unread and within the 10-minute window
    const now = new Date();
    const hasBeenRead = msg.read || msg.readAt !== null;
    const isPastWindow = msg.editableUntil && now > new Date(msg.editableUntil);

    if (hasBeenRead || isPastWindow) {
      return res.status(400).render('400', {
        title: 'Bad Request',
        user: req.user,
        error: 'Messages can only be edited if they are unread and within 10 minutes of being sent.'
      });
    }

    // Sanitize content (strip HTML, limit length)
    let cleanContent = (content || '').trim();
    if (cleanContent.length > 2000) {
      cleanContent = cleanContent.substring(0, 2000);
    }
    cleanContent = cleanContent.replace(/<[^>]*>/g, '');

    if (!cleanContent) {
      return res.status(400).render('400', { title: 'Bad Request', user: req.user, error: 'Message content cannot be empty after sanitization.' });
    }

    msg.content = cleanContent;
    await msg.save();

    console.log('✅ Message edited successfully:', { messageId: msg._id });
    res.redirect(`/auth/inbox?chat=${msg.recipient}`);
  } catch (err) {
    console.error('❌ editMessage Error:', err);
    res.status(500).render('500', { title: 'Error', user: req.user, layout: 'main' });
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