const User = require('../../models/User');

const safeRedirect = require('../../utils/safeRedirect');
const logger = require('../../utils/logger');

const flashKeys = ['pwd_reset', 'updated', 'error', 'exists', 'already'];

function appendFlash(url, key) {
  const parsed = new URL(url, 'http://local');
  flashKeys.forEach(name => parsed.searchParams.delete(name));
  parsed.searchParams.set(key, '1');
  return `${parsed.pathname}${parsed.search}`;
}

function wantsJson(req) {
  return req.xhr || req.get('accept')?.includes('application/json');
}

function sendError(req, res, redirectUrl, message, statusCode = 400) {
  if (wantsJson(req)) {
    return res.status(statusCode).json({ ok: false, message });
  }
  return res.redirect(appendFlash(redirectUrl, 'error'));
}


// POST /admin/users/:id/reset-password
exports.resetPassword = async (req, res) => {
  const password = String(req.body.password || req.body.newPassword || '');
  const targetRedirect = safeRedirect(req.body.redirect, '/admin/dashboard');
  console.log('[RESET_PASSWORD_DEBUG] incoming body keys:', Object.keys(req.body || {}));
  console.log('[RESET_PASSWORD_DEBUG] password length:', password.length, 'redirect:', req.body.redirect);

  if (!password || password.trim().length < 8) {
    console.log('[RESET_PASSWORD_DEBUG] rejected for length:', password.length, 'value preview:', password.slice(0, 2) + '***');
    return sendError(req, res, targetRedirect, 'Password must be at least 8 characters');
  }

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return sendError(req, res, targetRedirect, 'User not found', 404);
    }

    user.password = password.trim();
    console.log('[RESET_PASSWORD_DEBUG] accepted password length:', password.trim().length, 'for user:', String(user._id));
    user.resetRequested = false;
    user.mustChangePassword = true;
    user.passwordSetByAdmin = true;
    user.firstLoginCompleted = false;
    user.passwordChangedAt = new Date();

    await user.save();

    logger.info('User password reset successfully', {
      userId: user._id
    });

    const successRedirect = appendFlash(targetRedirect, 'pwd_reset');

    if (wantsJson(req)) {
      return res.json({
        ok: true,
        redirectUrl: successRedirect,
        userId: user._id
      });
    }

    res.redirect(successRedirect);

  } catch (err) {
    logger.error('Admin Reset Password Error', {
      err: err.message,
      stack: err.stack
    });

    return sendError(req, res, targetRedirect, 'An error occurred. Please try again.', 500);
  }
};


// POST /admin/users/:id/dismiss-reset
exports.dismissResetRequest = async (req, res) => {
  const targetRedirect = safeRedirect(req.body.redirect, '/admin/dashboard');

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { resetRequested: false },
      { new: true }
    );

    if (!user) {
      return sendError(req, res, targetRedirect, 'User not found', 404);
    }

    logger.info('Dismissed password reset request', {
      userId: user._id
    });

    const successRedirect = appendFlash(targetRedirect, 'updated');

    res.redirect(successRedirect);

  } catch (err) {
    logger.error('Dismiss Reset Request Error', {
      err: err.message,
      stack: err.stack
    });

    return sendError(req, res, targetRedirect, 'An error occurred. Please try again.', 500);
  }
};
