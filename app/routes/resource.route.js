const express = require('express');
const router = express.Router();
const resourcesController = require('../../resource/controllers/resources.controller');
const authMiddleware = require('../../auth/middleware/auth.middleware');
const multer = require('multer');
const path = require('path');

// Setup multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fs = require('fs');
        const uploadDir = path.join(__dirname, '../../public/uploads/resources');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'resource-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx|mp4|webm|mp3/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (ext) {
            return cb(null, true);
        }
        cb(new Error('Unsupported file type'));
    }
});

// Get all resources with search & filtering
router.get('/resources/search', resourcesController.searchResources);

// Get filter options for dropdowns
router.get('/resources/filter-options', resourcesController.getResourceFilterOptions);

// Existing routes
router.get('/resources/recent', resourcesController.getRecentResources);
router.get('/resources', resourcesController.getAllResources);
router.get('/resources/:id', resourcesController.getResourceDetails);
router.post('/resources/:id/access', authMiddleware.verifyToken, resourcesController.accessResource);


// Comment routes (require authentication)
router.get('/resources/:id/comments', resourcesController.getComments);
router.get('/resources/:id/commenters', resourcesController.getCommenters);

router.post('/resources/:id/comments', resourcesController.addComment);
router.post('/resources/:resourceId/comments/:commentId/like', resourcesController.likeComment);
router.delete('/resources/:resourceId/comments/:commentId', resourcesController.deleteComment);

// Admin routes
router.post('/resources',
    authMiddleware.verifyToken,
    // authMiddleware.isAdmin,
    upload.single('image'),
    resourcesController.addResource
);
router.put('/resources/:id', authMiddleware.verifyToken, upload.single('image'), resourcesController.updateResource);

router.get('/resources/:id', resourcesController.getResourceById);
router.post('/resources/:id/view', resourcesController.trackResourceView);
router.post('/resources/:id/like', authMiddleware.verifyToken, resourcesController.toggleResourceLike);

module.exports = router;