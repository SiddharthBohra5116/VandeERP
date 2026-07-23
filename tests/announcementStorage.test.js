const assert = require('assert');
const { storeAnnouncementFiles } = require('../utils/announcementStorage');

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
  process.env.NODE_ENV = previous;
  console.log('announcementStorage.test.js passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
