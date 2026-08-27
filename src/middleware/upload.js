const multer = require('multer');
const path = require('path');

// Use in-memory storage for Vercel Serverless Functions and Cloudinary stream upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype =
    allowedTypes.test(file.mimetype) ||
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'application/msword' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only images and documents (JPEG, PNG, WEBP, PDF, DOC, DOCX) are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max limit
  fileFilter: fileFilter,
});

module.exports = upload;
