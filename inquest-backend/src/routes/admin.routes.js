const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getOverview,
  getOrCreateProfile,
  updateProfilePhoto,
  updateProfileName,
} = require('../controllers/admin.controller');

router.use(requireAuth, requireRole('admin'));

router.post('/overview', getOverview);
router.post('/profile', getOrCreateProfile);
router.post('/profile/photo', updateProfilePhoto);
router.post('/profile/name', updateProfileName);

module.exports = router;
