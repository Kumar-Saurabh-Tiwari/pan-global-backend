const Event = require('../../app/models/event.model');
const User = require('../../auth/models/user.model');


// Add this function to your existing event.controller.js file

exports.addEvent = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            shortDescription,
            date,
            time,
            duration,
            location,
            virtualLink,
            eventType, // 'virtual', 'in-person', 'hybrid'
            eventFormat, // 'workshop', 'seminar', 'networking', 'conference', etc.
            capacity,
            price,
            chapters,
            speakers,
            sponsors,
            agenda,
            tags,
            isFeatured
        } = req.body;

        // Validation for required fields
        if (!title || !date || !eventType) {
            return res.status(400).json({ error: "Title, date, and event type are required" });
        }

        // Parse any JSON strings in the request body
        const parsedChapters = chapters ? (typeof chapters === 'string' ? JSON.parse(chapters) : chapters) : [];
        const parsedSpeakers = speakers ? (typeof speakers === 'string' ? JSON.parse(speakers) : speakers) : [];
        const parsedSponsors = sponsors ? (typeof sponsors === 'string' ? JSON.parse(sponsors) : sponsors) : [];
        const parsedAgenda = agenda ? (typeof agenda === 'string' ? JSON.parse(agenda) : agenda) : [];
        const parsedTags = tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [];

        // Create new event
        const newEvent = new Event({
            title,
            description: description || '',
            shortDescription: shortDescription || '',
            date: new Date(date),
            time: time || '12:00 PM',
            duration: duration || 60, // Default 1 hour
            location: location || 'TBD',
            virtualLink: virtualLink || '',
            eventType: eventType || 'in-person',
            eventFormat: eventFormat || 'networking',
            capacity: capacity ? parseInt(capacity) : null,
            price: price ? parseFloat(price) : 0,
            chapters: parsedChapters,
            speakers: parsedSpeakers,
            sponsors: parsedSponsors,
            agenda: parsedAgenda,
            tags: parsedTags,
            isFeatured: isFeatured === 'true' || isFeatured === true,
            registrationCount: 0,
            imageUrl: req.file ? `/uploads/events/${req.file.filename}` : null,
            createdBy: req.user.id,
            createdAt: new Date()
        });

        await newEvent.save();

        res.status(201).json({
            message: "Event created successfully",
            event: {
                id: newEvent._id,
                title: newEvent.title,
                date: newEvent.date,
                eventType: newEvent.eventType,
                location: newEvent.location,
                imageUrl: newEvent.imageUrl,
                isFeatured: newEvent.isFeatured
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        
        // Find the event
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        
        // Handle potential JSON strings
        if (updateData.chapters && typeof updateData.chapters === 'string') {
            updateData.chapters = JSON.parse(updateData.chapters);
        }
        if (updateData.speakers && typeof updateData.speakers === 'string') {
            updateData.speakers = JSON.parse(updateData.speakers);
        }
        if (updateData.sponsors && typeof updateData.sponsors === 'string') {
            updateData.sponsors = JSON.parse(updateData.sponsors);
        }
        if (updateData.agenda && typeof updateData.agenda === 'string') {
            updateData.agenda = JSON.parse(updateData.agenda);
        }
        if (updateData.tags && typeof updateData.tags === 'string') {
            updateData.tags = JSON.parse(updateData.tags);
        }
        
        // Handle boolean conversions
        if (updateData.isFeatured) {
            updateData.isFeatured = updateData.isFeatured === 'true' || updateData.isFeatured === true;
        }
        
        // Handle image update
        if (req.file) {
            updateData.imageUrl = `/uploads/events/${req.file.filename}`;
        }
        
        // Update the event
        const updatedEvent = await Event.findByIdAndUpdate(
            id, 
            updateData, 
            { new: true }
        );
        
        res.json({
            message: "Event updated successfully",
            event: {
                id: updatedEvent._id,
                title: updatedEvent.title,
                date: updatedEvent.date,
                eventType: updatedEvent.eventType,
                location: updatedEvent.location,
                imageUrl: updatedEvent.imageUrl,
                isFeatured: updatedEvent.isFeatured
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if event exists
        const event = await Event.findById(id);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        
        // Check if there are registrations
        if (event.attendees && event.attendees.length > 0) {
            return res.status(400).json({ 
                error: "Cannot delete an event with registrations. Cancel registrations first."
            });
        }
        
        await Event.findByIdAndDelete(id);
        
        res.json({ message: "Event deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get featured events
exports.getFeaturedEvents = async (req, res) => {
    try {
        const featuredEvents = await Event.find({ 
            isFeatured: true,
            date: { $gte: new Date() }
        }).sort({ date: 1 }).limit(1);
        
        if (featuredEvents.length === 0) {
            return res.json({ message: "No featured events found" });
        }
        
        const event = featuredEvents[0];
        const registeredCount = event.attendees.length;
        
        res.json({
            id: event._id,
            title: event.title,
            description: event.description,
            date: event.date,
            time: event.time,
            location: event.location,
            eventType: event.eventType,
            eventFormat: event.eventFormat,
            registeredCount: registeredCount,
            isRegistered: event.attendees.includes(req.user.id),
            imageUrl: event.imageUrl
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get upcoming events
exports.getUpcomingEvents = async (req, res) => {
    try {
        const { type, page = 1, limit = 10 } = req.query;
        const filter = {
            date: { $gte: new Date() }
        };
        
        if (type && type !== 'All Types') {
            filter.eventType = type.toLowerCase();
        }
        
        const events = await Event.find(filter)
            .sort({ date: 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const totalEvents = await Event.countDocuments(filter);
        
        res.json({
            events: events.map(event => ({
                id: event._id,
                title: event.title,
                description: event.description,
                date: event.date,
                time: event.time,
                location: event.location,
                eventType: event.eventType,
                eventFormat: event.eventFormat,
                registeredCount: event.attendees.length,
                spotsLeft: event.capacity - event.attendees.length,
                isRegistered: event.attendees.includes(req.user.id)
            })),
            totalPages: Math.ceil(totalEvents / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get registered events
exports.getRegisteredEvents = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        
        const events = await Event.find({
            attendees: req.user.id
        })
            .sort({ date: 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const totalEvents = await Event.countDocuments({
            attendees: req.user.id
        });
        
        res.json({
            events: events.map(event => ({
                id: event._id,
                title: event.title,
                description: event.description,
                date: event.date,
                time: event.time,
                location: event.location,
                eventType: event.eventType,
                eventFormat: event.eventFormat,
                registeredCount: event.attendees.length
            })),
            totalPages: Math.ceil(totalEvents / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get past events
exports.getPastEvents = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        
        const events = await Event.find({
            date: { $lt: new Date() }
        })
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        
        const totalEvents = await Event.countDocuments({
            date: { $lt: new Date() }
        });
        
        res.json({
            events: events.map(event => ({
                id: event._id,
                title: event.title,
                description: event.description,
                date: event.date,
                time: event.time,
                location: event.location,
                eventType: event.eventType,
                eventFormat: event.eventFormat,
                registeredCount: event.attendees.length,
                attended: event.attendees.includes(req.user.id)
            })),
            totalPages: Math.ceil(totalEvents / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get event details
exports.getEventDetails = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        
        res.json({
            id: event._id,
            title: event.title,
            description: event.description,
            date: event.date,
            time: event.time,
            location: event.location,
            eventType: event.eventType,
            eventFormat: event.eventFormat,
            capacity: event.capacity,
            registeredCount: event.attendees.length,
            spotsLeft: event.capacity - event.attendees.length,
            isRegistered: event.attendees.includes(req.user.id)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Register for an event
exports.registerForEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        
        // Check if already registered
        if (event.attendees.includes(req.user.id)) {
            return res.status(400).json({ error: "Already registered for this event" });
        }
        
        // Check if event is at full capacity
        if (event.attendees.length >= event.capacity) {
            return res.status(400).json({ error: "Event is at full capacity" });
        }
        
        // Check if event date has passed
        if (new Date(event.date) < new Date()) {
            return res.status(400).json({ error: "Cannot register for past events" });
        }
        
        // Add user to attendees
        event.attendees.push(req.user.id);
        await event.save();
        
        res.json({ 
            message: "Successfully registered for event",
            spotsLeft: event.capacity - event.attendees.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Cancel registration
exports.cancelRegistration = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        
        // Check if registered
        if (!event.attendees.includes(req.user.id)) {
            return res.status(400).json({ error: "Not registered for this event" });
        }
        
        // Check if event date has passed
        if (new Date(event.date) < new Date()) {
            return res.status(400).json({ error: "Cannot cancel registration for past events" });
        }
        
        // Remove user from attendees
        event.attendees = event.attendees.filter(id => id.toString() !== req.user.id);
        await event.save();
        
        res.json({ 
            message: "Registration cancelled successfully",
            spotsLeft: event.capacity - event.attendees.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get event types and formats for filters
exports.getEventFilters = async (req, res) => {
    try {
        const eventTypes = ['All Types', 'Virtual', 'Hybrid', 'In-person'];
        const eventFormats = ['All Formats', 'Workshop', 'Roundtable', 'Networking', 'Conference', 'Presentation'];
        
        res.json({
            eventTypes,
            eventFormats
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};