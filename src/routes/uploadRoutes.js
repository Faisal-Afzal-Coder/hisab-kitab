const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');

// @route   POST /api/upload (or /upload)
// @desc    Upload image/document directly to Cloudinary
// @access  Private
router.post('/', protect, upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided for upload' });
    }

    // Verify Cloudinary configuration
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return res.status(500).json({
        success: false,
        message:
          'Cloudinary storage is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in environment variables.',
      });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'hisab-kitab',
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary Upload Error]:', error);
          return res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload file to Cloudinary',
          });
        }

        res.status(200).json({
          success: true,
          fileUrl: result.secure_url,
          fileName: req.file.originalname,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
