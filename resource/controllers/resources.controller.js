const Resource = require('../../app/models/resource.model');

exports.getRecentResources = async (req, res) => {
    try {
        const resources = await Resource.find()
            .sort({ publishDate: -1 })
            .limit(5);
        
        res.json(resources.map(resource => ({
            id: resource._id,
            title: resource.title,
            category: resource.category,
            timeAgo: getTimeAgo(resource.publishDate),
            isNew: isNew(resource.publishDate),
            resourceType: resource.resourceType,
            level: resource.level,
            isExclusive: resource.isExclusive,
            imageUrl: resource.imageUrl,
            readTime: resource.readTime,
            duration: resource.duration
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getResourceDetails = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        res.json({
            id: resource._id,
            title: resource.title,
            description: resource.description,
            content: resource.content,
            category: resource.category,
            author: resource.author,
            publishDate: resource.publishDate,
            resourceType: resource.resourceType,
            level: resource.level,
            isExclusive: resource.isExclusive,
            readTime: resource.readTime,
            duration: resource.duration,
            tags: resource.tags,
            imageUrl: resource.imageUrl,
            downloadUrl: resource.downloadUrl
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add this new method for filtered resources
exports.getAllResources = async (req, res) => {
    try {
        const { type, level, category, search } = req.query;
        const filter = {};
        
        if (type && type !== 'All types') {
            filter.resourceType = type.toLowerCase();
        }
        
        if (level && level !== 'All levels') {
            filter.level = level.toLowerCase();
        }
        
        if (category && category !== 'All categories') {
            filter.category = category;
        }
        
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }
        
        const resources = await Resource.find(filter).sort({ publishDate: -1 });
        
        res.json({
            count: resources.length,
            resources: resources.map(resource => ({
                id: resource._id,
                title: resource.title,
                description: resource.description,
                resourceType: resource.resourceType,
                level: resource.level,
                isExclusive: resource.isExclusive,
                publishDate: resource.publishDate,
                formattedDate: formatDate(resource.publishDate),
                readTime: resource.readTime,
                duration: resource.duration,
                tags: resource.tags,
                imageUrl: resource.imageUrl
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.accessResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        // Add user to accessedBy array if not already there
        if (!resource.accessedBy.includes(req.user.id)) {
            resource.accessedBy.push(req.user.id);
            await resource.save();
        }
        
        res.json({ message: "Resource access recorded" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add this method to your resources.controller.js file
exports.addResource = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            content, 
            category, 
            author, 
            resourceType, 
            level, 
            isExclusive, 
            readTime, 
            duration,
            tags,
            downloadUrl
        } = req.body;
        
        // Validate required fields
        if (!title || !description || !category || !resourceType) {
            return res.status(400).json({ 
                error: "Required fields missing: title, description, category, and resourceType are required" 
            });
        }

        // Create a new resource object
        const newResource = new Resource({
            title,
            description,
            content: content || '',
            category,
            author: author || req.user.name, // Default to current user's name
            publishDate: new Date(),
            resourceType,
            level: level || 'intermediate', // Default to intermediate
            isExclusive: isExclusive !== undefined ? isExclusive : false,
            readTime: readTime || null, // Only for articles/documents
            duration: duration || null, // Only for videos/webinars
            tags: tags || [],
            imageUrl: req.file ? `/uploads/resources/${req.file.filename}` : null,
            downloadUrl: downloadUrl || null,
            accessedBy: [] // Initialize with empty array
        });
        
        // Save to database
        await newResource.save();
        
        // Return the created resource
        res.status(201).json({
            message: "Resource created successfully",
            resource: {
                id: newResource._id,
                title: newResource.title,
                description: newResource.description,
                category: newResource.category,
                resourceType: newResource.resourceType,
                level: newResource.level,
                isExclusive: newResource.isExclusive,
                publishDate: newResource.publishDate,
                formattedDate: formatDate(newResource.publishDate),
                imageUrl: newResource.imageUrl
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add these new methods for comprehensive resource searching and filtering

// Get all resource filter options for populating filter dropdowns
exports.getResourceFilterOptions = async (req, res) => {
    try {
        // Get unique resource types
        const types = await Resource.distinct('resourceType');
        
        // Get unique levels
        const levels = await Resource.distinct('level');
        
        // Get unique categories
        const categories = await Resource.distinct('category');
        
        res.json({
            types: ['All types', ...types.sort()],
            levels: ['All levels', 'beginner', 'intermediate', 'advanced'],
            categories: ['All categories', ...categories.sort()]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Enhanced search resources with comprehensive filtering
exports.searchResources = async (req, res) => {
    try {
        const { 
            search, 
            type, 
            level, 
            category, 
            exclusive, 
            page = 1, 
            limit = 12,
            sort = 'newest' 
        } = req.query;
        
        // Build filter object
        const filter = {};
        
        // Text search across multiple fields
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }
        
        // Filter by resource type
        if (type && type !== 'All types') {
            filter.resourceType = type.toLowerCase();
        }
        
        // Filter by level
        if (level && level !== 'All levels') {
            filter.level = level.toLowerCase();
        }
        
        // Filter by category
        if (category && category !== 'All categories') {
            filter.category = category;
        }
        
        // Filter by exclusivity
        if (exclusive === 'true') {
            filter.isExclusive = true;
        }
        
        // Determine sorting method
        let sortOption = {};
        switch (sort) {
            case 'oldest':
                sortOption = { publishDate: 1 };
                break;
            case 'alphabetical':
                sortOption = { title: 1 };
                break;
            case 'popular':
                sortOption = { 'accessedBy.length': -1 };
                break;
            case 'newest':
            default:
                sortOption = { publishDate: -1 };
        }
        
        // Calculate pagination
        const skip = (page - 1) * parseInt(limit);
        const limitNum = parseInt(limit);
        
        // Execute query with pagination
        const resources = await Resource.find(filter)
            .sort(sortOption)
            .skip(skip)
            .limit(limitNum);
        
        // Get total count for pagination
        const totalResources = await Resource.countDocuments(filter);
        
        // Format response
        res.json({
            count: totalResources,
            pages: Math.ceil(totalResources / limitNum),
            currentPage: parseInt(page),
            resources: resources.map(resource => ({
                id: resource._id,
                title: resource.title,
                description: resource.description,
                resourceType: resource.resourceType,
                level: resource.level,
                category: resource.category,
                isExclusive: resource.isExclusive,
                publishDate: resource.publishDate,
                formattedDate: formatDate(resource.publishDate),
                readTime: resource.readTime,
                duration: resource.duration,
                tags: resource.tags,
                imageUrl: resource.imageUrl,
                timeAgo: getTimeAgo(resource.publishDate),
                isNew: isNew(resource.publishDate)
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Helper functions
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days < 7) {
        return `${days} days ago`;
    } else if (days < 30) {
        return `${Math.floor(days / 7)} weeks ago`;
    } else {
        return `${Math.floor(days / 30)} months ago`;
    }
}

function isNew(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return days < 7;
}

function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
}