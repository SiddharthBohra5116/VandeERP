const mongoose = require('mongoose');

const completedTopicSchema = new mongoose.Schema({
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  completedDate: {
    type: String,
    required: true
  },

  note: {
    type: String,
    default: ''
  }
}, { _id: false });

const curriculumSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },

  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  },

  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },

  completedTopics: [completedTopicSchema],

  description: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// One curriculum progress record per course + batch
curriculumSchema.index({
  course: 1,
  batch: 1
}, { unique: true });

curriculumSchema.virtual('completedCount').get(function() {
  return Array.isArray(this.completedTopics) ? this.completedTopics.length : 0;
});

curriculumSchema.virtual('completionPct').get(function() {
  const courseDoc = this.course;

  if (
    !courseDoc ||
    !Array.isArray(courseDoc.modules) ||
    courseDoc.modules.length === 0
  ) {
    return 0;
  }

  const totalTopics = courseDoc.modules.reduce((total, module) => {
    return total + (Array.isArray(module.topics) ? module.topics.length : 0);
  }, 0);

  if (totalTopics <= 0) return 0;

  return Math.round((this.completedCount / totalTopics) * 100);
});

curriculumSchema.virtual('courseName').get(function() {
  return this.course && this.course.name ? this.course.name : 'Unknown Course';
});

curriculumSchema.virtual('topics').get(function() {
  const courseDoc = this.course;

  if (!courseDoc || !Array.isArray(courseDoc.modules)) {
    return [];
  }

  const flatTopics = [];

  courseDoc.modules.forEach(module => {
    if (Array.isArray(module.topics)) {
      module.topics.forEach(topic => {
        const completedInfo = Array.isArray(this.completedTopics)
          ? this.completedTopics.find(ct =>
              ct.topicId && topic._id && ct.topicId.toString() === topic._id.toString()
            )
          : null;

        flatTopics.push({
          _id: topic._id,
          moduleId: module._id,
          moduleTitle: module.title,
          name: topic.title,
          title: topic.title,
          description: topic.description || '',
          completed: !!completedInfo,
          completedDate: completedInfo ? completedInfo.completedDate : null,
          note: completedInfo ? completedInfo.note : '',
          order: topic.order || 0
        });
      });
    }
  });

  return flatTopics;
});

curriculumSchema.set('toObject', { virtuals: true });
curriculumSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Curriculum', curriculumSchema);