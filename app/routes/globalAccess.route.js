const express = require('express');
const router = express.Router();
const globalAccessController = require('../../globalAccess/controllers/globalAccess.controller');
const authMiddleware = require('../../auth/middleware/auth.middleware');
const multer = require('multer');
const path = require('path');

// Setup multer storage for chapter photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fs = require('fs');
        const uploadDir = path.join(__dirname, '../../public/uploads/chapters');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'chapter-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (ext) {
            return cb(null, true);
        }
        cb(new Error('Only JPG and PNG images are allowed'));
    }
});
// Benefits and usage routes
router.get('/global-access/benefits', authMiddleware.verifyToken, globalAccessController.getGlobalBenefits);
router.get('/global-access/usage', authMiddleware.verifyToken, globalAccessController.getGlobalUsage);

// Chapter listing and filtering routes
router.get('/global-access/chapters', authMiddleware.verifyToken, globalAccessController.getAllChapters);
router.get('/global-access/filters', authMiddleware.verifyToken, globalAccessController.getChapterFilters);
router.get('/global-access/locations', authMiddleware.verifyToken, globalAccessController.getChapterLocations);

// Chapter detail routes
router.get('/global-access/chapters/:id', authMiddleware.verifyToken, globalAccessController.getChapterDetails);
router.get('/global-access/chapters/:id/amenities', authMiddleware.verifyToken, globalAccessController.getChapterAmenities);
router.get('/global-access/chapters/:id/events', authMiddleware.verifyToken, globalAccessController.getChapterEvents);

// Chapter interaction routes
router.post('/global-access/record-visit', authMiddleware.verifyToken, globalAccessController.recordChapterVisit);

// NEW ROUTES: Admin routes to create global access records
router.post('/global-access', 
    authMiddleware.verifyToken, 
    // authMiddleware.isAdmin, 
    globalAccessController.addGlobalAccess
);

router.post('/global-access/bulk', 
    authMiddleware.verifyToken, 
    // authMiddleware.isAdmin, 
    globalAccessController.addBulkGlobalAccess
);

// Chapter Management - Admin only
router.post('/chapters', 
    authMiddleware.verifyToken, 
    // authMiddleware.isAdmin, 
    upload.single('photo'),
    globalAccessController.createChapter
);

module.exports = router;