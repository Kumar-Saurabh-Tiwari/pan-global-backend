const express = require('express');
const router = express.Router();
const { contactUs, getMessages } = require('../controllers/contact.controller');
const { verifyToken } = require('../../auth/middleware/auth.middleware');

router.post('/contact', verifyToken, contactUs);
router.get('/messages', verifyToken, getMessages);

module.exports = router;