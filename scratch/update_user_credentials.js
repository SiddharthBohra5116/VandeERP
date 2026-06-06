require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

async function run() {
  await connectDB();
  
  console.log('🔄 Fetching students, teachers, and counsellors...');
  const users = await User.find({ role: { $in: ['student', 'teacher', 'counsellor'] } });
  
  console.log(`Found ${users.length} users to update.`);
  
  let updatedCount = 0;
  for (const user of users) {
    let modified = false;
    
    // Convert email from @vandedigital.com to @gmail.com
    if (user.email.endsWith('@vandedigital.com')) {
      const oldEmail = user.email;
      user.email = user.email.replace('@vandedigital.com', '@gmail.com');
      console.log(`📧 Updating email: ${oldEmail} ➔ ${user.email}`);
      modified = true;
    }
    
    // Set password to password123
    // Note: mongoose pre-save hook will hash it
    user.password = 'password123';
    modified = true;
    
    if (modified) {
      await user.save();
      updatedCount++;
    }
  }
  
  console.log(`✅ Success! Updated ${updatedCount} users.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Migration Error:', err);
  process.exit(1);
});
