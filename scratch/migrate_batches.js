const mongoose = require('mongoose');
const User = require('../models/User');
const Batch = require('../models/Batch');
const logger = require('../utils/logger');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy';

async function migrate() {
  try {
    logger.info('Connecting to database for batch migration...', { MONGO_URI });
    await mongoose.connect(MONGO_URI);
    
    // 1. Fetch all unique batch names from active and inactive students/users
    const uniqueBatchNames = await User.distinct('batch');
    logger.info(`Found ${uniqueBatchNames.length} unique batch names in User collection`, { uniqueBatchNames });

    // Ensure 'General Batch' exists or is handled
    if (!uniqueBatchNames.includes('General Batch')) {
      uniqueBatchNames.push('General Batch');
    }

    // 2. Insert missing Batch documents
    let migratedCount = 0;
    for (const batchName of uniqueBatchNames) {
      if (!batchName || batchName.trim() === '') continue;

      const trimmedName = batchName.trim();
      const exists = await Batch.findOne({ name: trimmedName });
      if (!exists) {
        // Find a representative student to guess the course, otherwise default to 'Digital Marketing'
        const representativeUser = await User.findOne({ batch: batchName, role: 'student' });
        const course = (representativeUser && representativeUser.course) || 'Digital Marketing';

        await Batch.create({
          name: trimmedName,
          course: course === 'Both' ? 'Both' : course,
          capacity: 20,
          teachers: [],
          isActive: true
        });
        migratedCount++;
        logger.info(`Created Batch document: "${trimmedName}" (Course: ${course})`);
      }
    }

    logger.info(`Batch migration completed successfully. Created ${migratedCount} new Batch documents.`);
  } catch (err) {
    logger.error('Batch migration failed', { error: err.message, stack: err.stack });
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from database.');
  }
}

migrate();
