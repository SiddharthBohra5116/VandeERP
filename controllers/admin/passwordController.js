const User = require('../../models/User');

const safeRedirect = require('../../utils/safeRedirect');
const logger = require('../../utils/logger');


// POST /admin/users/:id/reset-password
exports.resetPassword = async (req, res) => {
  const { password } = req.body;
  const targetRedirect = safeRedirect(req.body.redirect, '/admin/dashboard');

  if (!password || password.trim().length < 8) {
    const errorRedirect = targetRedirect.includes('?')
      ? `${targetRedirect}&error=Password+must+be+at+least+8+characters`
      : `${targetRedirect}?error=Password+must+be+at+least+8+characters`;

    return res.redirect(errorRedirect);
  }

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      const errorRedirect = targetRedirect.includes('?')
        ? `${targetRedirect}&error=User+not+found`
        : `${targetRedirect}?error=User+not+found`;

      return res.redirect(errorRedirect);
    }

    user.password = password.trim();
    user.resetRequested = false;
    user.mustChangePassword = true;
    user.passwordSetByAdmin = true;
    user.firstLoginCompleted = false;
    user.passwordChangedAt = new Date();

    await user.save();

    logger.info('User password reset successfully', {
      userId: user._id
    });

    const successRedirect = targetRedirect.includes('?')
      ? `${targetRedirect}&pwd_reset=1`
      : `${targetRedirect}?pwd_reset=1`;

    res.redirect(successRedirect);

  } catch (err) {
    logger.error('Admin Reset Password Error', {
      err: err.message,
      stack: err.stack
    });

    const errorRedirect = targetRedirect.includes('?')
      ? `${targetRedirect}&error=1`
      : `${targetRedirect}?error=1`;

    res.redirect(errorRedirect);
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
      const errorRedirect = targetRedirect.includes('?')
        ? `${targetRedirect}&error=User+not+found`
        : `${targetRedirect}?error=User+not+found`;

      return res.redirect(errorRedirect);
    }

    logger.info('Dismissed password reset request', {
      userId: user._id
    });

    const successRedirect = targetRedirect.includes('?')
      ? `${targetRedirect}&updated=1`
      : `${targetRedirect}?updated=1`;

    res.redirect(successRedirect);

  } catch (err) {
    logger.error('Dismiss Reset Request Error', {
      err: err.message,
      stack: err.stack
    });

    const errorRedirect = targetRedirect.includes('?')
      ? `${targetRedirect}&error=1`
      : `${targetRedirect}?error=1`;

    res.redirect(errorRedirect);
  }
};
