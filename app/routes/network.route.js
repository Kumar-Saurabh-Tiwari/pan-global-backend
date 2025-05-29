const express = require('express');
const router = express.Router();
const networkController = require('../../network/controllers/network.controller');
const authMiddleware = require('../../auth/middleware/auth.middleware');

// Basic network routes
router.get('/network/stats', networkController.getNetworkStats);
router.get('/network/connections', networkController.getMyConnections);
router.get('/network/requests', networkController.getPendingRequests);
router.get('/network/chapter-members', networkController.getChapterMembers);

// Connection requests
router.post('/network/request', networkController.sendConnectionRequest);
router.post('/network/request/:connectionId/accept', networkController.acceptConnectionRequest);
router.post('/network/request/:connectionId/reject', networkController.rejectConnectionRequest);
router.delete('/network/connection/:connectionId', networkController.removeConnection);
// router.get('/network/search', networkController.searchConnections);

// New endpoints - Admin only
router.post('/network/connection', 
    authMiddleware.verifyToken,
    // authMiddleware.isAdmin, 
    networkController.createDirectConnection
);

router.post('/network/connections/bulk', 
    authMiddleware.verifyToken,
    // authMiddleware.isAdmin, 
    networkController.bulkAddConnections
);

// Recommendations
router.get('/network/potential-connections', networkController.findPotentialConnections);
router.get('/network/search', authMiddleware.verifyToken, networkController.searchNetwork);

module.exports = router;