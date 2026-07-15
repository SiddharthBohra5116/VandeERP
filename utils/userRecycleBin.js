const User = require('../models/User');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const logger = require('./logger');

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

async function purgeExpiredUsers() {
  const expired = await User.find({
    archivedAt: { $lte: new Date(Date.now() - RETENTION_MS) },
    role: { $ne: 'admin' }
  });

  for (const user of expired) {
    user.name = 'Deleted account';
    user.email = `deleted-${user._id}@removed.invalid`;
    user.phone = '';
    user.profilePic = null;
    user.address = '';
    user.city = '';
    user.dob = null;
    user.socialHandle = { instagram: '', linkedin: '' };
    user.archivedAt = null;
    user.anonymizedAt = new Date();
    user.tokenBlacklistedBefore = new Date();
    await user.save();
  }

  if (expired.length) logger.info('Expired recycle-bin accounts anonymized', { count: expired.length });
  return expired.length;
}

async function purgeExpiredLeads() {
  const expired = await Lead.find({ archivedAt: { $lte: new Date(Date.now() - RETENTION_MS) } }).select('_id');
  const ids = expired.map(lead => lead._id);
  if (ids.length) {
    await LeadActivity.deleteMany({ lead: { $in: ids } });
    await Lead.deleteMany({ _id: { $in: ids } });
    logger.info('Expired recycle-bin leads deleted', { count: ids.length });
  }
  return ids.length;
}

module.exports = { purgeExpiredUsers, purgeExpiredLeads, RETENTION_MS };
