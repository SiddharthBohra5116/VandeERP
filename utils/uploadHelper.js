const multer = require('multer');
const path = require('path');

const ALLOWED = [
  'image/jpeg', 'image/png', 'application/pdf'
];

const upload = multer({
  dest: path.join(__dirname, '../private-uploads/'),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Only JPEG, PNG, and PDF are permitted.'));
    }
  }
});

module.exports = upload;
