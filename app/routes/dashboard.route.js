const express = require('express');
const router = express.Router();
const dashboardController = require('../../dashboard/controllers/dashboard.controller');

// Get all dashboard data at once (optimized approach)
router.get('/dashboard/all', dashboardController.getAllDashboardData);

// Individual endpoints for more specific data needs
router.get('/dashboard', dashboardController.getDashboardData);
router.get('/dashboard/connection-points', dashboardController.getConnectionPoints);
router.get('/dashboard/chapters', dashboardController.getChapters);
router.get('/dashboard/upcoming-events', dashboardController.getUpcomingEvents);
router.get('/dashboard/membership', dashboardController.getMembershipData);
router.get('/dashboard/recent-resources', dashboardController.getRecentResources);

module.exports = router;