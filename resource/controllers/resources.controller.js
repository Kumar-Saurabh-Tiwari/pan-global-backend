const Resource = require('../../app/models/resource.model');
const User = require('../../auth/models/user.model');

exports.getRecentResources = async (req, res) => {
    try {
        const resources = await Resource.find()
            .sort({ publishDate: -1 })
            .limit(5);

        res.json({
            resources: resources.map(resource => ({
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
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get resource details with comments
exports.getResourceDetails = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        // Increment view count
        resource.views += 1;
        await resource.save();
        
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
            downloadUrl: resource.downloadUrl,
            videoUrl: resource.videoUrl,
            views: resource.views,
            downloads: resource.downloads,
            likes: resource.likes || [],
            likesCount: resource.likes?.length || 0,
            comments: resource.comments || [],
            commentCount: resource.commentCount || 0,
            commenters: resource.commenters || []
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

// Get resource by ID with complete details
exports.getResourceById = async (req, res) => {
    try {
        const resourceId = req.params.id;
        
        // Check if the ID is valid
        if (!mongoose.Types.ObjectId.isValid(resourceId)) {
            return res.status(400).json({ error: "Invalid resource ID" });
        }
        
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        // Get related resources (same category, excluding current resource)
        const relatedResources = await Resource.find({
            category: resource.category,
            _id: { $ne: resourceId }
        }).limit(3);
        
        // Calculate stats
        const stats = {
            views: resource.views || 0,
            downloads: resource.downloads || 0,
            likes: resource.likes?.length || 0,
            bookmarks: resource.bookmarks?.length || 0
        };
        
        // Format author information
        const author = resource.author ? {
            name: resource.author.name || resource.author,
            title: resource.author.title || '',
            avatar: resource.author.avatar || null
        } : null;
        
        res.json({
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
            tags: resource.tags || [],
            imageUrl: resource.imageUrl,
            videoUrl: resource.videoUrl,
            downloadUrl: resource.downloadUrl,
            content: resource.content,
            author,
            stats,
            relatedResources: relatedResources.map(related => ({
                id: related._id,
                title: related.title,
                description: related.description,
                resourceType: related.resourceType,
                level: related.level,
                isExclusive: related.isExclusive,
                publishDate: related.publishDate,
                formattedDate: formatDate(related.publishDate),
                imageUrl: related.imageUrl,
                timeAgo: getTimeAgo(related.publishDate)
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update resource by ID
exports.updateResource = async (req, res) => {
    try {
        const resourceId = req.params.id;
        
        // Check if the ID is valid
        if (!mongoose.Types.ObjectId.isValid(resourceId)) {
            return res.status(400).json({ error: "Invalid resource ID" });
        }
        
        const {
            title,
            description,
            resourceType,
            level,
            isExclusive,
            readTime,
            duration,
            tags,
            videoUrl,
            downloadUrl,
            content,
            author
        } = req.body;
        
        // Find the existing resource
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        // Update fields if provided
        if (title) resource.title = title;
        if (description) resource.description = description;
        if (resourceType) resource.resourceType = resourceType;
        if (level) resource.level = level;
        if (isExclusive !== undefined) resource.isExclusive = isExclusive;
        if (readTime !== undefined) resource.readTime = readTime;
        if (duration !== undefined) resource.duration = duration;
        if (tags) resource.tags = tags;
        if (videoUrl !== undefined) resource.videoUrl = videoUrl;
        if (downloadUrl !== undefined) resource.downloadUrl = downloadUrl;
        if (content !== undefined) resource.content = content;
        if (author) resource.author = author;
        
        // Handle image upload if new file is provided
        if (req.file) {
            resource.imageUrl = `/uploads/resources/${req.file.filename}`;
        }
        
        // Update the updatedAt timestamp
        resource.updatedAt = new Date();
        
        // Save the updated resource
        const updatedResource = await resource.save();
        
        res.json({
            message: "Resource updated successfully",
            resource: {
                id: updatedResource._id,
                title: updatedResource.title,
                description: updatedResource.description,
                resourceType: updatedResource.resourceType,
                level: updatedResource.level,
                isExclusive: updatedResource.isExclusive,
                publishDate: updatedResource.publishDate,
                formattedDate: formatDate(updatedResource.publishDate),
                readTime: updatedResource.readTime,
                duration: updatedResource.duration,
                tags: updatedResource.tags,
                imageUrl: updatedResource.imageUrl,
                videoUrl: updatedResource.videoUrl,
                downloadUrl: updatedResource.downloadUrl,
                content: updatedResource.content,
                author: updatedResource.author,
                updatedAt: updatedResource.updatedAt
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Track resource view (call this when user views a resource)
exports.trackResourceView = async (req, res) => {
    try {
        const resourceId = req.params.id;
        
        const resource = await Resource.findByIdAndUpdate(
            resourceId,
            { $inc: { views: 1 } },
            { new: true }
        );
        
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        res.json({ 
            message: "View tracked successfully",
            views: resource.views 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Like or unlike a resource
exports.toggleResourceLike = async (req, res) => {
    try {
        const resourceId = req.params.id;
        const userId = req.user.id;
        
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        // Initialize likes array if it doesn't exist
        if (!resource.likes) {
            resource.likes = [];
        }
        
        const userLikedIndex = resource.likes.indexOf(userId);
        let liked = false;
        
        if (userLikedIndex > -1) {
            // User has already liked, so unlike
            resource.likes.splice(userLikedIndex, 1);
            liked = false;
        } else {
            // User hasn't liked, so like
            resource.likes.push(userId);
            liked = true;
        }
        
        await resource.save();
        
        res.json({
            message: liked ? "Resource liked" : "Resource unliked",
            liked,
            likesCount: resource.likes.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Helper function to format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Get all resources with comment counts
// exports.getAllResources = async (req, res) => {
//     try {
//         const { type, level, category, search, page = 1, limit = 10 } = req.query;
//         const filter = {};
        
//         if (type && type !== 'All types') {
//             filter.resourceType = type.toLowerCase();
//         }
        
//         if (level && level !== 'All levels') {
//             filter.level = level.toLowerCase();
//         }
        
//         if (category && category !== 'All categories') {
//             filter.category = category;
//         }
        
//         if (search) {
//             filter.$or = [
//                 { title: { $regex: search, $options: 'i' } },
//                 { description: { $regex: search, $options: 'i' } },
//                 { tags: { $regex: search, $options: 'i' } }
//             ];
//         }
        
//         const skip = (parseInt(page) - 1) * parseInt(limit);
        
//         const resources = await Resource.find(filter)
//             .sort({ publishDate: -1 })
//             .skip(skip)
//             .limit(parseInt(limit));
        
//         const totalResources = await Resource.countDocuments(filter);
        
//         res.json({
//             count: resources.length,
//             total: totalResources,
//             page: parseInt(page),
//             pages: Math.ceil(totalResources / parseInt(limit)),
//             resources: resources.map(resource => ({
//                 id: resource._id,
//                 title: resource.title,
//                 description: resource.description,
//                 resourceType: resource.resourceType,
//                 level: resource.level,
//                 isExclusive: resource.isExclusive,
//                 publishDate: resource.publishDate,
//                 formattedDate: formatDate(resource.publishDate),
//                 readTime: resource.readTime,
//                 duration: resource.duration,
//                 tags: resource.tags,
//                 imageUrl: resource.imageUrl,
//                 views: resource.views || 0,
//                 downloads: resource.downloads || 0,
//                 likesCount: resource.likes?.length || 0,
//                 commentCount: resource.commentCount || 0,
//                 commenters: resource.commenters || []
//             }))
//         });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// };

// Add comment to resource
exports.addComment = async (req, res) => {
    try {
        const { comment } = req.body;
        const resourceId = req.params.id;
        
        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({ error: "Comment cannot be empty" });
        }
        
        if (comment.length > 1000) {
            return res.status(400).json({ error: "Comment is too long (max 1000 characters)" });
        }
        
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        // Get user details
        const user = await User.findById(req.user.id).select('name profilePhoto');
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Create new comment
        const newComment = {
            user: req.user.id,
            userName: user.name,
            userAvatar: user.profilePhoto,
            comment: comment.trim(),
            createdAt: new Date(),
            likes: [],
            replies: []
        };
        
        // Add comment to resource
        resource.comments.push(newComment);
        resource.commentCount = resource.comments.length;
        
        // Update or add to commenters array
        const existingCommenter = resource.commenters.find(
            commenter => commenter.userId.toString() === req.user.id
        );
        
        if (existingCommenter) {
            // Update existing commenter
            existingCommenter.lastCommentDate = new Date();
            existingCommenter.commentCount += 1;
        } else {
            // Add new commenter
            resource.commenters.push({
                userId: req.user.id,
                userName: user.name,
                userAvatar: user.profilePhoto,
                lastCommentDate: new Date(),
                commentCount: 1
            });
        }
        
        await resource.save();
        
        // Return the new comment with its ID
        const savedComment = resource.comments[resource.comments.length - 1];
        
        res.status(201).json({
            message: "Comment added successfully",
            comment: {
                id: savedComment._id,
                user: savedComment.user,
                userName: savedComment.userName,
                userAvatar: savedComment.userAvatar,
                comment: savedComment.comment,
                createdAt: savedComment.createdAt,
                likes: savedComment.likes,
                likesCount: savedComment.likes.length
            },
            commentCount: resource.commentCount,
            commenters: resource.commenters
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get comments for a resource
exports.getComments = async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'newest' } = req.query;
        const resourceId = req.params.id;
        
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        let comments = [...resource.comments];
        
        // Sort comments
        if (sortBy === 'oldest') {
            comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (sortBy === 'mostLiked') {
            comments.sort((a, b) => b.likes.length - a.likes.length);
        } else {
            // Default: newest first
            comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedComments = comments.slice(skip, skip + parseInt(limit));
        
        res.json({
            comments: paginatedComments.map(comment => ({
                id: comment._id,
                user: comment.user,
                userName: comment.userName,
                userAvatar: comment.userAvatar,
                comment: comment.comment,
                createdAt: comment.createdAt,
                formattedDate: formatDate(comment.createdAt),
                likes: comment.likes,
                likesCount: comment.likes.length,
                replies: comment.replies || [],
                repliesCount: comment.replies?.length || 0
            })),
            pagination: {
                total: comments.length,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(comments.length / parseInt(limit))
            },
            commentCount: resource.commentCount,
            commenters: resource.commenters
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Like/Unlike a comment
exports.likeComment = async (req, res) => {
    try {
        const { resourceId, commentId } = req.params;
        
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        const comment = resource.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ error: "Comment not found" });
        }
        
        const userLikedIndex = comment.likes.indexOf(req.user.id);
        let action = '';
        
        if (userLikedIndex > -1) {
            // Unlike comment
            comment.likes.splice(userLikedIndex, 1);
            action = 'unliked';
        } else {
            // Like comment
            comment.likes.push(req.user.id);
            action = 'liked';
        }
        
        await resource.save();
        
        res.json({
            message: `Comment ${action} successfully`,
            action,
            likesCount: comment.likes.length,
            userLiked: action === 'liked'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete comment (author or admin only)
exports.deleteComment = async (req, res) => {
    try {
        const { resourceId, commentId } = req.params;
        
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        const comment = resource.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ error: "Comment not found" });
        }
        
        // Check if user can delete comment (author or admin)
        if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Not authorized to delete this comment" });
        }
        
        // Remove comment
        resource.comments.pull(commentId);
        resource.commentCount = resource.comments.length;
        
        // Update commenters array
        const commenterIndex = resource.commenters.findIndex(
            commenter => commenter.userId.toString() === comment.user.toString()
        );
        
        if (commenterIndex > -1) {
            const commenter = resource.commenters[commenterIndex];
            commenter.commentCount -= 1;
            
            // Remove commenter if no more comments
            if (commenter.commentCount <= 0) {
                resource.commenters.splice(commenterIndex, 1);
            }
        }
        
        await resource.save();
        
        res.json({
            message: "Comment deleted successfully",
            commentCount: resource.commentCount,
            commenters: resource.commenters
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get commenters list
exports.getCommenters = async (req, res) => {
    try {
        const resourceId = req.params.id;
        
        const resource = await Resource.findById(resourceId).select('commenters commentCount');
        if (!resource) {
            return res.status(404).json({ error: "Resource not found" });
        }
        
        // Sort commenters by most comments or most recent
        const sortedCommenters = resource.commenters.sort((a, b) => {
            return b.commentCount - a.commentCount || new Date(b.lastCommentDate) - new Date(a.lastCommentDate);
        });
        
        res.json({
            totalCommenters: resource.commenters.length,
            totalComments: resource.commentCount,
            commenters: sortedCommenters.map(commenter => ({
                userId: commenter.userId,
                userName: commenter.userName,
                userAvatar: commenter.userAvatar,
                commentCount: commenter.commentCount,
                lastCommentDate: commenter.lastCommentDate,
                formattedDate: formatDate(commenter.lastCommentDate)
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};