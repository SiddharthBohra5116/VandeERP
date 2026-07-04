const multer = require('multer');
const path = require('path');
const fs = require('fs');

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const CSV_TYPES = ['text/csv', 'text/plain', 'text/tab-separated-values', 'application/csv', 'application/vnd.ms-excel'];
const ALLOWED = [...new Set([...IMAGE_TYPES, ...DOCUMENT_TYPES, ...CSV_TYPES])];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '../private-uploads/');
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '';
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'profilePic' && IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else if (file.fieldname === 'idProof' && DOCUMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else if (
      file.fieldname === 'leadCsv' &&
      (CSV_TYPES.includes(file.mimetype) || ['.csv', '.tsv', '.txt'].includes(path.extname(file.originalname).toLowerCase()))
    ) {
      cb(null, true);
    } else if (!['profilePic', 'idProof'].includes(file.fieldname) && ALLOWED.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Profile pictures must be JPG, PNG, or WebP. Documents must be JPG, PNG, PDF, or CSV where supported.'));
    }
  }
});

module.exports = upload;
