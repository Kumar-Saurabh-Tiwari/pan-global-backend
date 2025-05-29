const express = require('express');
const router = express.Router();
const forumController = require('../../forum/controllers/forum.controller');
const authMiddleware = require('../../auth/middleware/auth.middleware');

// Category routes
router.get('/forum/categories', forumController.getAllCategories);

// Admin category management routes
router.post('/forum/categories', 
    authMiddleware.verifyToken,
    // authMiddleware.isAdmin,
    forumController.addCategory
);

router.put('/forum/categories/:id', 
    authMiddleware.verifyToken,
    // authMiddleware.isAdmin,
    forumController.updateCategory
);

router.delete('/forum/categories/:id', 
    authMiddleware.verifyToken,
    // authMiddleware.isAdmin,
    forumController.deleteCategory
);

// Topic routes
router.get('/forum/topics', forumController.getTopics);
router.get('/forum/topics/:id', forumController.getTopic);
router.post('/forum/topics', authMiddleware.verifyToken, forumController.createTopic);

// Search and filtering
router.get('/forum/search', forumController.searchTopics);
router.get('/forum/filters', forumController.getTopicFilters);

// New topic creation
router.get('/forum/topic-form-options',  forumController.getTopicFormOptions);

// Reply routes
router.post('/forum/topics/:topicId/replies', forumController.addReply);
router.post('/forum/replies/:replyId/like',  forumController.likeReply);

// Trending tags
router.get('/forum/trending-tags', forumController.getTrendingTags);

module.exports = router;