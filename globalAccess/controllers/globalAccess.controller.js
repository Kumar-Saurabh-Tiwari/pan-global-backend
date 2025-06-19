const User = require('../../auth/models/user.model');
const Chapter = require('../../app/models/chapter.model');
const ChapterAccess = require('../../app/models/globalAccess.model');
const Event = require('../../app/models/event.model');
const mongoose = require('mongoose');

// Get global benefits based on membership type
exports.getGlobalBenefits = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Define benefits based on membership type
        const benefits = [
            { 
                id: "chapter_access", 
                title: "Access to all PanGlobal chapter locations",
                available: true
            },
            { 
                id: "priority_booking", 
                title: "Priority booking for meeting rooms and facilities",
                available: user.memberType === "premium" 
            },
            { 
                id: "complimentary_refreshments", 
                title: "Complimentary refreshments at all chapters",
                available: user.memberType === "premium" 
            },
            { 
                id: "guest_passes", 
                title: "Guest passes (3 per month) for colleagues",
                available: user.memberType === "premium" 
            },
            { 
                id: "networking_intros", 
                title: "Cross-chapter networking introductions",
                available: true 
            },
            { 
                id: "priority_registration", 
                title: "Global events priority registration",
                available: user.memberType === "premium" 
            }
        ];
        
        res.json({
            memberType: user.memberType,
            benefits: benefits.filter(benefit => benefit.available)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get global usage statistics
exports.getGlobalUsage = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        
        // Convert user ID to ObjectId
        const userId = new mongoose.Types.ObjectId(req.user.id);
        
        // Get user details to determine membership limits
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Define limits based on membership type
        const membershipLimits = {
            basic: {
                maxVisitsPerYear: 12,
                maxChaptersAccess: 1,
                maxEventsPerYear: 6
            },
            premium: {
                maxVisitsPerYear: 25,
                maxChaptersAccess: 8,
                maxEventsPerYear: 10
            },
            executive: {
                maxVisitsPerYear: 50,
                maxChaptersAccess: 12,
                maxEventsPerYear: 20
            }
        };
        
        const limits = membershipLimits[user.memberType] || membershipLimits.basic;
        
        // Get visits this year
        const visitsThisYear = await ChapterAccess.countDocuments({
            user: userId,
            visitDate: { $gte: startOfYear }
        });
        
        // Get unique chapters visited this year
        const chaptersVisitedThisYear = await ChapterAccess.distinct('chapter', {
            user: userId,
            visitDate: { $gte: startOfYear }
        });
        
        // Get total available chapters
        const totalChapters = await Chapter.countDocuments({ 
            status: { $in: ['Active', 'active'] } 
        });
        
        // Get events attended this year
        const eventsAttendedThisYear = await Event.countDocuments({
            attendees: userId,
            date: { $gte: startOfYear }
        });
        
        // Get most visited chapter this year
        const chapterVisits = await ChapterAccess.aggregate([
            { $match: { user: userId, visitDate: { $gte: startOfYear } } },
            { $group: { _id: "$chapter", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);
        
        let mostVisitedChapter = null;
        if (chapterVisits.length > 0) {
            const chapter = await Chapter.findById(chapterVisits[0]._id);
            if (chapter) {
                mostVisitedChapter = {
                    name: chapter.name,
                    location: `${chapter.city}, ${chapter.country}`,
                    visits: chapterVisits[0].count,
                    displayText: `${chapter.name} (${chapterVisits[0].count} visits)`
                };
            }
        }
        
        // Calculate percentage values for progress bars (0-100)
        const visitsPercentage = Math.min((visitsThisYear / limits.maxVisitsPerYear) * 100, 100);
        const chaptersPercentage = Math.min((chaptersVisitedThisYear.length / limits.maxChaptersAccess) * 100, 100);
        const eventsPercentage = Math.min((eventsAttendedThisYear / limits.maxEventsPerYear) * 100, 100);
        
        // Get user's total lifetime stats for additional context
        const lifetimeStats = {
            totalVisits: await ChapterAccess.countDocuments({ user: userId }),
            totalChaptersVisited: (await ChapterAccess.distinct('chapter', { user: userId })).length,
            totalEventsAttended: await Event.countDocuments({ attendees: userId })
        };
        
        res.json({
            // Current year stats with limits
            visitsThisYear: {
                current: visitsThisYear,
                max: limits.maxVisitsPerYear,
                percentage: Math.round(visitsPercentage),
                displayText: `${visitsThisYear}/${limits.maxVisitsPerYear}`,
                remaining: Math.max(limits.maxVisitsPerYear - visitsThisYear, 0)
            },
            chaptersVisited: {
                current: chaptersVisitedThisYear.length,
                max: Math.min(limits.maxChaptersAccess, totalChapters), // Don't exceed available chapters
                percentage: Math.round(chaptersPercentage),
                displayText: `${chaptersVisitedThisYear.length}/${Math.min(limits.maxChaptersAccess, totalChapters)}`,
                totalAvailable: totalChapters,
                remaining: Math.max(limits.maxChaptersAccess - chaptersVisitedThisYear.length, 0)
            },
            eventsAttended: {
                current: eventsAttendedThisYear,
                max: limits.maxEventsPerYear,
                percentage: Math.round(eventsPercentage),
                displayText: `${eventsAttendedThisYear}/${limits.maxEventsPerYear}`,
                remaining: Math.max(limits.maxEventsPerYear - eventsAttendedThisYear, 0)
            },
            mostVisitedChapter,
            
            // Additional context
            membershipType: user.memberType,
            membershipLimits: limits,
            lifetimeStats,
            
            // Summary
            summary: {
                utilizationRate: Math.round(((visitsThisYear + chaptersVisitedThisYear.length + eventsAttendedThisYear) / 
                    (limits.maxVisitsPerYear + limits.maxChaptersAccess + limits.maxEventsPerYear)) * 100),
                isNearLimits: visitsPercentage > 80 || chaptersPercentage > 80 || eventsPercentage > 80,
                topUsage: Math.max(visitsPercentage, chaptersPercentage, eventsPercentage)
            }
        });
    } catch (err) {
        console.error('Error in getGlobalUsage:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get all chapters with details
exports.getAllChapters = async (req, res) => {
    try {
        const { region, status } = req.query;
        const filter = {};
        
        if (region && region !== 'All Regions') {
            filter.region = region;
        }
        
        if (status && status !== 'All Statuses') {
            filter.status = status;
        }
        
        const chapters = await Chapter.find(filter).sort({ name: 1 });
        
        const result = await Promise.all(chapters.map(async (chapter) => {
            // Get member count
            const memberCount = chapter.members.length;
            
            // Get upcoming events count
            const eventsCount = await Event.countDocuments({
                location: { $regex: chapter.city, $options: 'i' },
                date: { $gte: new Date() }
            });
            
            // Get next event
            const nextEvent = await Event.findOne({
                location: { $regex: chapter.city, $options: 'i' },
                date: { $gte: new Date() }
            }).sort({ date: 1 });
            
            return {
                id: chapter._id,
                name: chapter.name,
                location: `${chapter.city}, ${chapter.country}`,
                status: chapter.status || 'Active',
                memberCount,
                eventsPerMonth: eventsCount,
                nextEvent: nextEvent ? {
                    title: nextEvent.title,
                    date: nextEvent.date
                } : null,
                amenities: chapter.amenities || []
            };
        }));
        
        // Return result wrapped in a "chapters" property
        res.json({
            chapters: result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get chapter details
exports.getChapterDetails = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.id)
            .populate('members', 'name profilePhoto');
            
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        
        // Get upcoming events
        const upcomingEvents = await Event.find({
            location: { $regex: chapter.city, $options: 'i' },
            date: { $gte: new Date() }
        }).sort({ date: 1 }).limit(5);
        
        // Get next event
        const nextEvent = upcomingEvents.length > 0 ? {
            title: upcomingEvents[0].title,
            date: formatEventDate(upcomingEvents[0].date)
        } : null;
        
        // Get user's visits to this chapter
        let userVisits = 0;
        if (req.user && req.user.id) {
            userVisits = await ChapterAccess.countDocuments({
                user: req.user.id,
                chapter: chapter._id
            });
        }
        
        res.json({
            id: chapter._id,
            name: chapter.name,
            location: `${chapter.city}, ${chapter.country}`,
            address: chapter.address,
            status: chapter.status || 'Active',
            region: chapter.region || 'Unknown',
            members: {
                count: chapter.members.length,
                list: chapter.members.map(member => ({
                    id: member._id,
                    name: member.name,
                    profilePhoto: member.profilePhoto
                }))
            },
            amenities: chapter.amenities || [],
            eventsPerMonth: upcomingEvents.length,
            nextEvent,
            upcomingEvents: upcomingEvents.map(event => ({
                id: event._id,
                title: event.title,
                date: event.date,
                formattedDate: formatEventDate(event.date),
                time: event.time
            })),
            userVisits
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Record a visit to a chapter
exports.recordChapterVisit = async (req, res) => {
    try {
        const { chapterId, accessType } = req.body;
        
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        
        const newVisit = new ChapterAccess({
            user: req.user.id,
            chapter: chapterId,
            accessType: accessType || 'physical'
        });
        
        await newVisit.save();
        
        res.json({ message: "Visit recorded successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get available regions and statuses for filtering
exports.getChapterFilters = async (req, res) => {
    try {
        const regions = await Chapter.distinct('region');
        const statuses = ['Active', 'Coming Soon', 'Planned'];
        
        res.json({
            regions: ['All Regions', ...regions],
            statuses: ['All Statuses', ...statuses]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get chapter amenities
exports.getChapterAmenities = async (req, res) => {
    try {
        const chapterId = req.params.id;
        
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        
        // Get all amenities for the chapter
        const amenities = chapter.amenities || [];
        
        // Categorize amenities by type
        const categorizedAmenities = {
            workspaces: amenities.filter(a => ['Co-working Space', 'Private Offices', 'Meeting Rooms'].includes(a)),
            services: amenities.filter(a => ['Business Center', 'Translation Services'].includes(a)),
            facilities: amenities.filter(a => ['Conference Rooms', 'Conference Center', 'Event Space', 'Networking Lounge', 'Business Lounge'].includes(a)),
            other: amenities.filter(a => !['Co-working Space', 'Private Offices', 'Meeting Rooms', 'Business Center', 
                'Translation Services', 'Conference Rooms', 'Conference Center', 'Event Space', 'Networking Lounge', 'Business Lounge'].includes(a))
        };
        
        res.json({
            chapterId: chapter._id,
            chapterName: chapter.name,
            amenities: categorizedAmenities
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get upcoming events for a specific chapter
exports.getChapterEvents = async (req, res) => {
    try {
        const chapterId = req.params.id;
        
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        
        // Get upcoming events for the chapter
        const upcomingEvents = await Event.find({
            location: { $regex: chapter.city, $options: 'i' },
            date: { $gte: new Date() }
        }).sort({ date: 1 }).limit(5);
        
        res.json({
            chapterId: chapter._id,
            chapterName: chapter.name,
            location: `${chapter.city}, ${chapter.country}`,
            eventsPerMonth: upcomingEvents.length,
            upcomingEvents: upcomingEvents.map(event => ({
                id: event._id,
                title: event.title,
                date: event.date,
                formattedDate: formatEventDate(event.date),
                time: event.time,
                eventType: event.eventType,
                eventFormat: event.eventFormat
            })),
            nextEvent: upcomingEvents.length > 0 ? {
                title: upcomingEvents[0].title,
                date: formatEventDate(upcomingEvents[0].date)
            } : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get chapter locations for map view
exports.getChapterLocations = async (req, res) => {
    try {
        const chapters = await Chapter.find({}).select('name city country coordinates status region');
        
        const locations = chapters.map(chapter => ({
            id: chapter._id,
            name: chapter.name,
            location: `${chapter.city}, ${chapter.country}`,
            coordinates: chapter.coordinates || { lat: 0, lng: 0 },
            status: chapter.status || 'Active',
            region: chapter.region || 'Unknown'
        }));
        
        res.json(locations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add new global access record
exports.addGlobalAccess = async (req, res) => {
    try {
        const { 
            userId, 
            chapterId, 
            accessType, 
            startDate, 
            endDate, 
            notes 
        } = req.body;

        // Validate required fields
        if (!userId || !chapterId) {
            return res.status(400).json({ 
                error: "User ID and Chapter ID are required" 
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if chapter exists
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }

        // Create the new access record
        const newAccess = new ChapterAccess({
            user: userId,
            chapter: chapterId,
            accessType: accessType || 'standard', // default to standard if not provided
            visitDate: startDate || new Date(),
            endDate: endDate || null,
            notes: notes || '',
            createdBy: req.user.id, // Track who created this access record
            createdAt: new Date()
        });

        await newAccess.save();

        // Return success response with created access record
        res.status(201).json({
            message: "Global access record created successfully",
            access: {
                id: newAccess._id,
                user: {
                    id: user._id,
                    name: user.name
                },
                chapter: {
                    id: chapter._id,
                    name: chapter.name,
                    location: `${chapter.city}, ${chapter.country}`
                },
                accessType: newAccess.accessType,
                visitDate: newAccess.visitDate,
                endDate: newAccess.endDate,
                notes: newAccess.notes
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add bulk global access records
exports.addBulkGlobalAccess = async (req, res) => {
    try {
        const { accessRecords } = req.body;
        
        if (!Array.isArray(accessRecords) || accessRecords.length === 0) {
            return res.status(400).json({ 
                error: "Valid access records array is required" 
            });
        }
        
        const results = {
            total: accessRecords.length,
            successful: 0,
            failed: 0,
            errors: []
        };
        
        // Process each access record
        for (const record of accessRecords) {
            try {
                const { userId, chapterId, accessType, startDate, endDate, notes } = record;
                
                // Skip invalid records
                if (!userId || !chapterId) {
                    results.failed++;
                    results.errors.push(`Invalid record: Missing user or chapter ID`);
                    continue;
                }
                
                // Check if user and chapter exist
                const user = await User.findById(userId);
                const chapter = await Chapter.findById(chapterId);
                
                if (!user || !chapter) {
                    results.failed++;
                    results.errors.push(`User or chapter not found: ${userId}, ${chapterId}`);
                    continue;
                }
                
                // Create new access record
                const newAccess = new ChapterAccess({
                    user: userId,
                    chapter: chapterId,
                    accessType: accessType || 'standard',
                    visitDate: startDate || new Date(),
                    endDate: endDate || null,
                    notes: notes || '',
                    createdBy: req.user.id,
                    createdAt: new Date()
                });
                
                await newAccess.save();
                results.successful++;
            } catch (error) {
                results.failed++;
                results.errors.push(error.message);
            }
        }
        
        res.status(201).json({ 
            message: "Bulk global access creation complete",
            results
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add a new chapter
exports.createChapter = async (req, res) => {
    try {
        const { 
            name, 
            city, 
            country, 
            address, 
            region,
            status,
            coordinates,
            amenities,
            description,
            contactEmail,
            contactPhone,
            openingHours,
            photo
        } = req.body;
        
        // Validate required fields
        if (!name || !city || !country) {
            return res.status(400).json({ 
                error: "Name, city, and country are required" 
            });
        }
        
        // Create a new chapter
        const newChapter = new Chapter({
            name,
            city,
            country,
            address,
            region: region || 'Americas',
            status: status || 'Active',
            coordinates: coordinates || { lat: 0, lng: 0 },
            amenities: amenities || [],
            members: [],
            description,
            contactEmail,
            contactPhone,
            openingHours,
            photo: req.file ? `/uploads/chapters/${req.file.filename}` : photo || null,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await newChapter.save();
        
        res.status(201).json({
            message: "Chapter created successfully",
            chapter: {
                id: newChapter._id,
                name: newChapter.name,
                location: `${newChapter.city}, ${newChapter.country}`,
                status: newChapter.status,
                region: newChapter.region,
                amenitiesCount: newChapter.amenities.length
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Helper function to format dates in a nice way
function formatEventDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(date);
    return `${months[d.getMonth()]} ${d.getDate()}`;
}