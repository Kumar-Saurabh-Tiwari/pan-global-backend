const express = require('express');
const router = express.Router();
const memberBenefitsController = require('../../memberBenefits/controllers/memberBenefits.controller');
const authMiddleware = require('../../auth/middleware/auth.middleware');

// Initialize user membership (for existing users)
// router.post('/member-benefits/initialize', 
//     authMiddleware.verifyToken, 
//     memberBenefitsController.initializeUserMembership
// );

// Get current user's benefits
router.get('/member-benefits/current', 
    authMiddleware.verifyToken, 
    memberBenefitsController.getCurrentBenefits
);

// Get membership tiers
router.get('/member-benefits/tiers', 
    authMiddleware.verifyToken, 
    memberBenefitsController.getMembershipTiers
);

// Get usage statistics
router.get('/member-benefits/usage-stats', 
    authMiddleware.verifyToken, 
    memberBenefitsController.getUsageStats
);

// Get ROI metrics
router.get('/member-benefits/roi-metrics', 
    authMiddleware.verifyToken, 
    memberBenefitsController.getROIMetrics
);

// Get exclusive offers
router.get('/member-benefits/offers', 
    authMiddleware.verifyToken, 
    memberBenefitsController.getExclusiveOffers
);

// Get renewal information
router.get('/member-benefits/renewal', 
    authMiddleware.verifyToken, 
    memberBenefitsController.getRenewalInfo
);
// Get Member information
router.get('/member-benefits/info', 
    authMiddleware.verifyToken, 
    memberBenefitsController.getMembershipData
);

// Track benefit usage
router.post('/member-benefits/track-usage', 
    authMiddleware.verifyToken, 
    memberBenefitsController.trackBenefitUsage
);

// Upgrade membership
router.post('/member-benefits/upgrade', 
    authMiddleware.verifyToken, 
    memberBenefitsController.upgradeMembership
);

// Admin routes
// router.post('/member-benefits/seed', 
//     authMiddleware.verifyToken, 
//     authMiddleware.isAdmin, 
//     memberBenefitsController.seedMembershipData
// );

module.exports = router;