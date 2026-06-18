const readline = require('readline');
require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

async function main() {
  await connectDB();

  const email = (process.env.ADMIN_RECOVERY_EMAIL || await ask('Admin email: ')).toLowerCase();
  const password = process.env.ADMIN_RECOVERY_PASSWORD || await ask('New password (min 8 chars): ');

  if (!email || !email.includes('@')) {
    throw new Error('A valid admin email is required.');
  }

  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const admin = await User.findOne({ email, role: 'admin' });
  if (!admin) {
    throw new Error('No admin account found with that email.');
  }

  admin.password = password;
  admin.resetRequested = false;
  admin.mustChangePassword = true;
  admin.passwordSetByAdmin = true;
  admin.firstLoginCompleted = false;
  admin.passwordChangedAt = new Date();
  admin.status = 'active';
  admin.isActive = true;

  await admin.save();

  console.log('Admin temporary password has been set. Login once, then create a new password in the app.');
}

main()
  .catch(err => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
    setTimeout(() => process.exit(process.exitCode || 0), 100);
  });
