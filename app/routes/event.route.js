const express = require('express');
const router = express.Router();
const eventController = require('../../event/controllers/event.controller');
const authMiddleware = require('../../auth/middleware/auth.middleware');
const multer = require('multer');

// Setup multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });
// Get featured event
router.get('/events/featured', eventController.getFeaturedEvents);

// Get events by type (upcoming, registered, past)
router.get('/events/upcoming', eventController.getUpcomingEvents);
router.get('/events/registered', eventController.getRegisteredEvents);
router.get('/events/past', eventController.getPastEvents);

// Get event filter options
router.get('/events/filters', eventController.getEventFilters);

// Get event details
router.get('/events/:id', eventController.getEventDetails);

// Register for an event
router.post('/events/:id/register', eventController.registerForEvent);

// Cancel registration
router.post('/events/:id/cancel', eventController.cancelRegistration);

// Create new event (Admin only)
router.post('/events',
    authMiddleware.verifyToken,
    // authMiddleware.isAdmin,
    upload.single('image'),
    eventController.addEvent
);

// Update event (Admin only)
router.put('/events/:id',
    authMiddleware.verifyToken,
    // authMiddleware.isAdmin,
    upload.single('image'),
    eventController.updateEvent
);

// Delete event (Admin only)
router.delete('/events/:id',
    authMiddleware.verifyToken,
    // authMiddleware.isAdmin,
    eventController.deleteEvent
);
module.exports = router;