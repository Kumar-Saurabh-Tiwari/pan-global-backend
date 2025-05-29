const express = require('express');
const router = express.Router();
const settingsController = require('../../settings/controllers/settings.controller');
const authMiddleware = require('../../auth/middleware/auth.middleware');
const multer = require('multer');

// Setup multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Profile routes
router.get('/profile', authMiddleware.verifyToken, settingsController.getUserProfile);
router.put('/profile', authMiddleware.verifyToken, settingsController.updateProfile);
router.post('/profile/photo', authMiddleware.verifyToken, upload.single('photo'), settingsController.updateProfilePhoto);

// Account & security routes
router.put('/password', authMiddleware.verifyToken, settingsController.changePassword);

// Notification settings
router.put('/notifications', authMiddleware.verifyToken, settingsController.updateNotifications);

// Privacy settings
router.put('/privacy', authMiddleware.verifyToken, settingsController.updatePrivacy);

module.exports = router;