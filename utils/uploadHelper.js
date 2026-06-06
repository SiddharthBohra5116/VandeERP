const multer = require('multer');
const path = require('path');

const ALLOWED = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf', 'video/mp4', 'application/zip'
];

const upload = multer({
  dest: path.join(__dirname, '../public/uploads/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Allowed types: JPEG, PNG, WEBP, PDF, MP4, ZIP'));
    }
  }
});

module.exports = upload;
