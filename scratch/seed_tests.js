const mongoose = require('mongoose');
require('dotenv').config();

// Register all schemas to avoid MissingSchemaErrors during populate
const User = require('../models/User');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const Progress = require('../models/Progress');

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/vande_academy';

async function run() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Clean existing progress records to seed fresh ones
    await Progress.deleteMany({});
    console.log('Cleared existing progress records');

    // Fetch schedules to know which batches and courses teachers are assigned to
    const schedules = await Schedule.find({}).populate('course').populate('batch');
    console.log(`Found ${schedules.length} schedules`);

    const tests = [
      { name: 'Practical Assessment 1', totalMarks: 100 },
      { name: 'Midterm Theory Test', totalMarks: 100 },
      { name: 'Weekly Quiz 2', totalMarks: 50 }
    ];

    const remarks = [
      'Excellent performance and attention to detail.',
      'Completed all requirements on time.',
      'Showed strong improvement this week.',
      'Good understanding, needs more practical practice.',
      'Participated actively, kept trying.'
    ];

    const teacherRemarks = [
      'Steady progress. Hardworking and focused.',
      'Very creative approach to solving tasks.',
      'Regular in class, maintains focus.',
      'Outstanding efforts and output.'
    ];

    let seededCount = 0;

    for (const schedule of schedules) {
      if (!schedule.batch || !schedule.course || !schedule.teacher) continue;

      // Find all students in this batch
      const students = await Student.find({ batch: schedule.batch._id });

      for (const student of students) {
        // Double check if record already exists (could happen with multiple schedules)
        let record = await Progress.findOne({ student: student._id, course: schedule.course._id });
        if (!record) {
          record = new Progress({
            student: student._id,
            course: schedule.course._id,
            batch: schedule.batch._id,
            teacher: schedule.teacher,
            testResults: [],
            teacherRemark: teacherRemarks[Math.floor(Math.random() * teacherRemarks.length)]
          });

          // Seed 2-3 tests randomly
          const numTests = Math.floor(Math.random() * 2) + 2; // 2 or 3 tests
          for (let i = 0; i < numTests; i++) {
            const testTemplate = tests[i];
            const score = Math.floor(Math.random() * (testTemplate.totalMarks - 20)) + 20; // Score between 20 and totalMarks
            
            record.testResults.push({
              testName: testTemplate.name,
              score,
              totalMarks: testTemplate.totalMarks,
              date: new Date(Date.now() - (3 - i) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              remarks: remarks[Math.floor(Math.random() * remarks.length)]
            });
          }

          await record.save();
          seededCount++;
        }
      }
    }

    console.log(`Successfully seeded ${seededCount} student progress records!`);
  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

run();
