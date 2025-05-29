const User = require('../../auth/models/user.model');
const Event = require('../../app/models/event.model');
const Resource = require('../../app/models/resource.model');

exports.getMembershipDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.json({
            membershipStatus: {
                type: user.memberType,
                since: user.createdAt,
                period: "23 months", // Calculate from user data
                expiryDate: user.membershipExpiry
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getMembershipStats = async (req, res) => {
    try {
        // Get count of resources accessed by this user
        const resourcesAccessed = await Resource.countDocuments({
            accessedBy: req.user.id
        });
        
        // Get count of events attended by this user
        const eventsAttended = await Event.countDocuments({
            attendees: req.user.id
        });
        
        res.json({
            resourcesAccessed,
            eventsAttended,
            daysRemaining: 285 // Calculate from user data
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};