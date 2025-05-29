const express = require('express');
const router = express.Router();
const { subscribe, getSubscribers } = require('../controllers/subscribe.controller');
const authMiddleware = require('../../auth/middleware/auth.middleware');

router.post('/subscribe', authMiddleware.verifyToken, subscribe);
router.get('/subscribers', authMiddleware.verifyToken, getSubscribers);

module.exports = router;