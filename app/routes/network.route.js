const express = require('express');
const router = express.Router();
const networkController = require('../../network/controllers/network.controller');
const authMiddleware = require('../../auth/middleware/auth.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware.verifyToken);

// Network overview and stats
router.get('/network/stats', networkController.getNetworkStats);

// Member management
router.get('/network/members', networkController.getAllMembers);
router.get('/network/members/follow-ups', networkController.getFollowUpsDue);
router.get('/network/members/recent', networkController.getRecentCommunications);
router.get('/network/members/key-relationships', networkController.getKeyRelationships);

// Relationship management
router.put('/network/relationship/:connectionId', networkController.updateRelationship);
router.post('/network/relationship/:connectionId/communication', networkController.logCommunication);
router.post('/network/relationship/:connectionId/follow-up', networkController.scheduleFollowUp);
router.post('/network/relationship/:connectionId/note', networkController.addNote);

// Filter options
router.get('/network/chapters', networkController.getChapters);
router.get('/network/industries', networkController.getIndustries);

// Legacy/existing routes (maintained for backward compatibility)
router.get('/network/connections', networkController.getMyConnections);
router.get('/network/requests', networkController.getPendingRequests);
router.get('/network/chapter-members', networkController.getChapterMembers);

// Connection requests
router.post('/network/request', networkController.sendConnectionRequest);
router.post('/network/request/:connectionId/accept', networkController.acceptConnectionRequest);
router.post('/network/request/:connectionId/reject', networkController.rejectConnectionRequest);
router.delete('/network/connection/:connectionId', networkController.removeConnection);

// Admin routes
router.post('/network/connection', 
    authMiddleware.isAdmin, 
    networkController.createDirectConnection
);

router.post('/network/connections/bulk', 
    authMiddleware.isAdmin, 
    networkController.bulkAddConnections
);

// Search and recommendations
router.get('/network/potential-connections', networkController.findPotentialConnections);
router.get('/network/search', networkController.searchNetwork);

module.exports = router;