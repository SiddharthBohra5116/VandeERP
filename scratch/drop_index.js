const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy';

async function run() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const collections = await mongoose.connection.db.collections();
    const progressesCollection = collections.find(c => c.collectionName === 'progresses');
    
    if (progressesCollection) {
      const indexes = await progressesCollection.indexes();
      console.log('Current Indexes:', indexes);
      
      const hasOldIndex = indexes.some(idx => idx.name === 'student_1_batch_1');
      if (hasOldIndex) {
        await progressesCollection.dropIndex('student_1_batch_1');
        console.log('Successfully dropped index student_1_batch_1');
      } else {
        console.log('Index student_1_batch_1 not found');
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

run();
