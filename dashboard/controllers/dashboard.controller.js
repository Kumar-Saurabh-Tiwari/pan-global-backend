const User = require('../../auth/models/user.model');
const ConnectionPoint = require('../../app/models/connectionPoint.model');
const Chapter = require('../../app/models/chapter.model'); // Fixed import
const Event = require('../../app/models/event.model');
const Resource = require('../../app/models/resource.model');

exports.getDashboardData = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.json({
            message: `Welcome back, ${user.name || 'Member'}`,
            subtitle: "Here's what's happening with your PanGlobal Network membership."
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getConnectionPoints = async (req, res) => {
    try {
        const points = await ConnectionPoint.findOne({ userId: req.user.id });
        const lastMonthPoints = points && points.history && points.history.length >= 2 
            ? points.history[points.history.length - 2].total 
            : 0;
        const currentPoints = points ? points.total : 320; // Default to 320 if no data
        const growth = lastMonthPoints > 0 
            ? ((currentPoints - lastMonthPoints) / lastMonthPoints * 100).toFixed(0) 
            : 15; // Default to 15% if no historical data
        
        res.json({
            total: currentPoints,
            growth: `${growth}%`,
            description: "Loyalty program points",
            trend: growth >= 0 ? "positive" : "negative"
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getChapters = async (req, res) => {
    try {
        const chapters = await Chapter.find();
        
        res.json({
            total: chapters.length || 8,
            description: "Access to locations"
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getUpcomingEvents = async (req, res) => {
    try {
        // Get next 30 days
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        // Get events in next 30 days
        const events = await Event.find({
            date: { 
                $gte: new Date(), 
                $lte: thirtyDaysFromNow 
            }
        }).sort({ date: 1 });
        
        // Calculate growth from last month
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        const lastMonthEvents = await Event.countDocuments({
            date: {
                $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), lastMonth.getDate()),
                $lte: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, lastMonth.getDate())
            }
        });
        
        const growth = lastMonthEvents > 0 
            ? ((events.length - lastMonthEvents) / lastMonthEvents * 100).toFixed(0)
            : 20; // Default to 20% if no historical data
        
        res.json({
            total: events.length,
            description: "Events in next 30 days",
            growth: `${growth}%`,
            trend: growth >= 0 ? "positive" : "negative",
            events: events.slice(0, 3).map(event => ({
                id: event._id,
                title: event.title,
                date: event.date,
                time: event.time,
                location: event.location,
                eventType: event.eventType,
                eventFormat: event.eventFormat
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getMembershipData = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Calculate days until renewal
        const currentDate = new Date();
        const expiryDate = user.membershipExpiry || new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
        const daysUntilRenewal = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
        
        // Calculate membership period in months
        const startDate = user.createdAt;
        const monthsActive = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24 * 30));
        
        // Get resources accessed count
        const resourcesAccessed = await Resource.countDocuments({
            accessedBy: req.user.id
        });
        
        // Get events attended count
        const eventsAttended = await Event.countDocuments({
            attendees: req.user.id,
            date: { $lt: new Date() }
        });
        
        res.json({
            daysUntilRenewal: daysUntilRenewal || 285,
            description: "Until renewal",
            membershipType: user.memberType || "premium",
            memberSince: user.createdAt,
            membershipPeriod: monthsActive || 23,
            resourcesAccessed: resourcesAccessed || 12,
            eventsAttended: eventsAttended || 3
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getRecentResources = async (req, res) => {
    try {
        const resources = await Resource.find()
            .sort({ publishDate: -1 })
            .limit(4);
        
        res.json({
            resources: resources.map(resource => {
                const publishDate = new Date(resource.publishDate);
                const now = new Date();
                const diffTime = Math.abs(now - publishDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let timeAgo;
                if (diffDays <= 7) {
                    timeAgo = diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
                } else if (diffDays <= 30) {
                    const weeks = Math.floor(diffDays / 7);
                    timeAgo = weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
                } else {
                    const months = Math.floor(diffDays / 30);
                    timeAgo = months === 1 ? "1 month ago" : `${months} months ago`;
                }
                
                return {
                    id: resource._id,
                    title: resource.title,
                    category: resource.category,
                    timeAgo: timeAgo,
                    isNew: diffDays <= 7,
                    resourceType: resource.resourceType,
                    imageUrl: resource.imageUrl
                };
            })
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAllDashboardData = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Welcome message
        const welcome = {
            message: `Welcome back, ${user.name || 'Member'}`,
            subtitle: "Here's what's happening with your PanGlobal Network membership."
        };
        
        // Get upcoming events
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const events = await Event.find({
            date: { 
                $gte: new Date(), 
                $lte: thirtyDaysFromNow 
            }
        }).sort({ date: 1 }).limit(3);
        
        const upcomingEvents = {
            total: events.length || 3,
            description: "Events in next 30 days",
            growth: "+20%",
            events: events.map(event => ({
                id: event._id,
                title: event.title,
                date: event.date,
                eventType: event.eventType
            }))
        };
        
        // Get connection points
        const points = await ConnectionPoint.findOne({ userId: req.user.id });
        const connectionPoints = {
            total: (points && points.total) || 320,
            description: "Loyalty program points",
            growth: "+15%"
        };
        
        // Get chapters
        const chapters = await Chapter.find();
        const globalChapters = {
            total: chapters.length || 8,
            description: "Access to locations"
        };
        
        // Get membership data
        const expiryDate = user.membershipExpiry || new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate());
        const daysUntilRenewal = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        
        const membership = {
            daysUntilRenewal: daysUntilRenewal || 285,
            description: "Until renewal",
            membershipType: user.memberType || "premium",
            memberSince: user.createdAt || "6/15/2023",
            membershipPeriod: 23,
            resourcesAccessed: 12,
            eventsAttended: 3
        };
        
        // Get recent resources
        const resources = await Resource.find()
            .sort({ publishDate: -1 })
            .limit(4);
        
        const recentResources = resources.map(resource => {
            const publishDate = new Date(resource.publishDate);
            const now = new Date();
            const diffTime = Math.abs(now - publishDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let timeAgo;
            if (diffDays <= 7) {
                timeAgo = diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
            } else if (diffDays <= 30) {
                const weeks = Math.floor(diffDays / 7);
                timeAgo = weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
            } else {
                const months = Math.floor(diffDays / 30);
                timeAgo = months === 1 ? "1 month ago" : `${months} months ago`;
            }
            
            return {
                id: resource._id,
                title: resource.title,
                category: resource.category,
                timeAgo: timeAgo,
                isNew: diffDays <= 7
            };
        });
        
        res.json({
            welcome,
            stats: {
                upcomingEvents,
                connectionPoints,
                globalChapters,
                membership
            },
            recentResources,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};