const assert = require('assert');
const {
  storeAnnouncementFiles,
  storeProfilePhoto,
  storeUploadedFiles,
  getCloudinaryDeliveryUrl
} = require('../utils/announcementStorage');

(async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const [stored] = await storeAnnouncementFiles([{
    filename: 'material.pdf',
    originalname: 'Lesson material.pdf',
    mimetype: 'application/pdf',
    size: 42
  }]);

  assert.strictEqual(stored.url, '/files/material.pdf');
  assert.strictEqual(stored.fileName, 'Lesson material.pdf');
  const photo = await storeProfilePhoto({
    filename: 'avatar.png',
    originalname: 'avatar.png',
    mimetype: 'image/png',
    size: 10
  });
  assert.strictEqual(photo.url, '/files/avatar.png');
  const [submission] = await storeUploadedFiles([{
    filename: 'work.pdf',
    originalname: 'work.pdf',
    mimetype: 'application/pdf',
    size: 12
  }], 'assignment-submissions');
  assert.strictEqual(submission.url, '/files/work.pdf');
  assert(require('../models/Assignment').schema.path('filePublicId'));
  assert(require('../models/Assignment').schema.path('submissions.filePublicId'));
  assert(require('../models/DailyUpdate').schema.path('filePublicId'));
  assert(require('../models/Message').schema.path('attachments.publicId'));
  assert(require('../models/Student').schema.path('documents.idProofPublicId'));
  const cloudEnv = [
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET
  ];
  process.env.CLOUDINARY_CLOUD_NAME = 'demo';
  process.env.CLOUDINARY_API_KEY = 'key';
  process.env.CLOUDINARY_API_SECRET = 'secret';
  assert(getCloudinaryDeliveryUrl('vande-erp/test', 'image').includes('/authenticated/'));
  [process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET] = cloudEnv;
  process.env.NODE_ENV = previous;
  console.log('announcementStorage.test.js passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
