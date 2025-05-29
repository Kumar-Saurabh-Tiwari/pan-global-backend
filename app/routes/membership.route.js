const express = require('express');
const router = express.Router();
const membershipController = require('../../membership/controllers/membership.controller');

// Get membership details
router.get('/membership', membershipController.getMembershipDetails);

// Get membership statistics
router.get('/membership/stats', membershipController.getMembershipStats);

module.exports = router;