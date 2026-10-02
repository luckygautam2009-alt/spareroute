const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Verify that an uploaded file's magic bytes match a JPEG or PNG.
 * Never trust the client-supplied MIME type alone.
 *
 * JPEG: starts with FF D8 FF
 * PNG:  starts with 89 50 4E 47 0D 0A 1A 0A
 *
 * Returns true if the buffer matches, false otherwise.
 */
function verifyImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 8) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return true;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return true;
  }

  return false;
}

/**
 * Express middleware that verifies magic bytes AFTER multer has processed the file.
 * Must be placed after upload.single() or upload.fields() in the route chain.
 */
function requireValidImageMagicBytes(req, res, next) {
  if (!req.file) {
    return next();
  }
  if (!verifyImageMagicBytes(req.file.buffer)) {
    return res.status(400).json({
      success: false,
      error: 'File does not appear to be a valid JPEG or PNG image.',
      message: 'File does not appear to be a valid JPEG or PNG image.',
    });
  }
  next();
}

module.exports = { upload, verifyImageMagicBytes, requireValidImageMagicBytes };
