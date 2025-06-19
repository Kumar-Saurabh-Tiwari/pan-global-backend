const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
// In your auth routes file (auth.route.js)
const authMiddleware = require('../middleware/auth.middleware');
// Register new user
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Logout
router.post('/logout', authController.logout);

// Password recovery
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

router.get('/security-settings',authMiddleware.verifyToken,authController.getSecuritySettings);
router.put('/change-password',authMiddleware.verifyToken,authController.changePassword);
router.put('/toggle-2fa',authMiddleware.verifyToken,authController.toggleTwoFactor);
module.exports = router;