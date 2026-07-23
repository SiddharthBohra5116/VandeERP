const Message = require('../../models/Message');

const safeRedirect = require('../../utils/safeRedirect');
const logger = require('../../utils/logger');
const { storeUploadedFiles, discardStoredFiles } = require('../../utils/announcementStorage');


// POST /admin/messages/send
exports.postSendMessage = async (req, res) => {
  try {
    const {
      recipientId,
      content,
      replyTo,
      redirect
    } = req.body;

    const { validateAndSanitizeMessage } = require('../../utils/messageValidator');

    const { cleanContent } = await validateAndSanitizeMessage(
      req.user,
      recipientId,
      content || ''
    );

    const attachments = await storeUploadedFiles(req.files || [], 'messages');

    try {
      await Message.create({
        sender: req.user._id,
        recipient: recipientId,
        replyTo: replyTo || null,
        content: cleanContent,
        attachments
      });
    } catch (error) {
      await discardStoredFiles(attachments);
      throw error;
    }

    res.redirect(`${redirect || '/admin/users'}?posted=1`);

  } catch (err) {
    logger.error('Send Message Error', {
      err: err.message,
      stack: err.stack
    });

    res.redirect(
      `${req.body.redirect || '/admin/users'}?error=${encodeURIComponent(err.message)}`
    );
  }
};


// POST /admin/messages/:id/read
exports.markMessageRead = async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id
      },
      {
        $set: {
          read: true,
          readAt: new Date()
        }
      },
      {
        new: true
      }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.json({
      success: true,
      message: 'Message marked as read'
    });

  } catch (err) {
    logger.error('Mark Message Read Error', {
      err: err.message
    });

    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};


// POST /admin/messages/read-all
exports.markAllMessagesRead = async (req, res) => {
  try {
    await Message.updateMany(
      {
        recipient: req.user._id,
        read: false
      },
      {
        $set: {
          read: true,
          readAt: new Date()
        }
      }
    );

    res.json({
      success: true
    });

  } catch (err) {
    logger.error('Mark All Messages Read Error', {
      err: err.message
    });

    res.status(500).json({
      success: false
    });
  }
};
