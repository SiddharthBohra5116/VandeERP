/**
 * TokenBlacklist Model — AntiGravity Module 3 (JWT Sentinel)
 * Stores individual JWTs that have been explicitly invalidated.
 * TTL index on expiresAt auto-cleans entries after the token would
 * have expired anyway — keeps collection small.
 *
 * NOTE: This handles per-token revocation. For revoking ALL tokens
 * for a user (e.g. after admin blacklist), set User.tokenBlacklistedBefore
 * to the current timestamp and reject any token where iat < that value.
 */
const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
  token:          { type: String, required: true, index: { unique: true } },
  reason:         { type: String, required: true },
  blacklistedAt:  { type: Date, default: Date.now },
  expiresAt:      { type: Date, required: true, index: { expireAfterSeconds: 0 } }
});

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
