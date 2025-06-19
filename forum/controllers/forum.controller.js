const { Category, Topic, Reply } = require('../../app/models/forum.model');
const User = require('../../auth/models/user.model');
const mongoose = require('mongoose');

// Category Controllers
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ order: 1 });

        // Get topic count for each category
        const result = await Promise.all(categories.map(async (category) => {
            const topicCount = await Topic.countDocuments({ category: category._id });
            return {
                id: category._id,
                name: category.name,
                slug: category.slug,
                icon: category.icon,
                description: category.description,
                topicCount
            };
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Topic Controllers
exports.getTopics = async (req, res) => {
    try {
        const { category, filter = 'recent', page = 1, limit = 10, search } = req.query;
        const query = {};

        // Apply category filter if provided
        if (category) {
            const categoryObj = await Category.findOne({ slug: category });
            if (categoryObj) {
                query.category = categoryObj._id;
            }
        }

        // Apply search filter if provided
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        let sort = {};

        // Apply sorting based on filter
        switch (filter) {
            case 'popular':
                sort = { views: -1 };
                break;
            case 'unanswered':
                query.replies = { $size: 0 };
                sort = { createdAt: -1 };
                break;
            case 'recent':
            default:
                sort = { lastActivity: -1 };
        }

        // Get topics with pagination
        const topics = await Topic.find(query)
            .populate('author', 'name')
            .populate('category', 'name slug')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Get total count for pagination
        const totalTopics = await Topic.countDocuments(query);

        // Format the response
        const formattedTopics = topics.map(topic => ({
            id: topic._id,
            title: topic.title,
            content: topic.content,
            author: {
                id: topic.author._id,
                name: topic.author.name
            },
            category: {
                // id: topic.category._id,
                // name: topic.category.name,
                // slug: topic.category.slug
            },
            tags: topic.tags,
            replies: topic.replies.length,
            views: topic.views,
            createdAt: topic.createdAt,
            lastActivity: topic.lastActivity,
            isPinned: topic.isPinned,
            isPopular: topic.isPopular
        }));

        res.json({
            topics: formattedTopics,
            pagination: {
                total: totalTopics,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalTopics / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching topics:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get single topic with replies
// Get single topic with replies (enhanced with user profiles)
exports.getTopic = async (req, res) => {
    try {
        const topicId = req.params.id;

        // Find the topic and increment view count
        const topic = await Topic.findByIdAndUpdate(
            topicId,
            { $inc: { views: 1 } },
            { new: true }
        )
            .populate('author', 'name title company profilePhoto')
            .populate('category', 'name slug')
            .populate({
                path: 'replies',
                populate: {
                    path: 'author',
                    select: 'name title company profilePhoto'
                },
                options: { sort: { createdAt: 1 } } // Sort replies chronologically
            });

        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        // Helper function to create full photo URL
        const getFullPhotoUrl = (profilePhoto, req) => {
            if (!profilePhoto) return null;
            const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
            return profilePhoto.startsWith('http') ? profilePhoto : `${baseUrl}${profilePhoto}`;
        };

        // Format the response with enhanced user info
        const formattedTopic = {
            id: topic._id,
            title: topic.title,
            content: topic.content,
            author: {
                id: topic.author._id,
                name: topic.author.name,
                title: topic.author.title || '',
                company: topic.author.company || '',
                profilePhoto: getFullPhotoUrl(topic.author.profilePhoto, req),
                initials: topic.author.name ? topic.author.name.split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2) : 'U'
            },
            category: topic.category ? {
                id: topic.category._id,
                name: topic.category.name,
                slug: topic.category.slug
            } : null,
            tags: topic.tags,
            views: topic.views,
            createdAt: topic.createdAt,
            lastActivity: topic.lastActivity,
            isPinned: topic.isPinned,
            isLocked: topic.isLocked,
            totalReplies: topic.replies.length,
            replies: topic.replies.map(reply => ({
                id: reply._id,
                content: reply.content,
                author: {
                    id: reply.author._id,
                    name: reply.author.name,
                    title: reply.author.title || '',
                    company: reply.author.company || '',
                    profilePhoto: getFullPhotoUrl(reply.author.profilePhoto, req),
                    initials: reply.author.name ? reply.author.name.split(' ')
                        .map(word => word[0])
                        .join('')
                        .toUpperCase()
                        .substring(0, 2) : 'U'
                },
                likes: reply.likes ? reply.likes.length : 0,
                isLikedByUser: reply.likes ? reply.likes.includes(req.user?.id) : false,
                createdAt: reply.createdAt,
                updatedAt: reply.updatedAt,
                timeAgo: getTimeAgo(reply.createdAt)
            }))
        };

        res.json(formattedTopic);
    } catch (err) {
        console.error('Error fetching topic:', err);
        res.status(500).json({ error: err.message });
    }
};

// Create new topic with enhanced validation and response
exports.createTopic = async (req, res) => {
    try {
        const { title, content, categoryId, tags } = req.body;
        
        // Validate required fields
        if (!title || title.trim().length < 3) {
            return res.status(400).json({ error: 'Title must be at least 3 characters long' });
        }
        
        if (!content || content.trim().length < 10) {
            return res.status(400).json({ error: 'Content must be at least 10 characters long' });
        }
        
        // if (!categoryId) {
        //     return res.status(400).json({ error: 'Category is required' });
        // }
        
        // Check if category exists
        // const category = await Category.findById(categoryId);
        // if (!category) {
        //     return res.status(404).json({ error: 'Category not found' });
        // }
        
        // Normalize tags (remove duplicates, trim whitespace, limit to 5 tags)
        let processedTags = [];
        if (tags && Array.isArray(tags)) {
            processedTags = [...new Set(tags.map(tag => tag.trim().toLowerCase()))]
                .filter(tag => tag.length > 0)
                .slice(0, 5);
        }
        
        // Create the new topic
        const newTopic = new Topic({
            title: title.trim(),
            content,
            author: req.user.id,
            // category: categoryId|| '123456789012',
            tags: processedTags,
            lastActivity: new Date()
        });
        
        await newTopic.save();
        
        // Get author details
        const author = await User.findById(req.user.id).select('name title company');
        
        res.status(201).json({
            message: 'Topic created successfully',
            topic: {
                id: newTopic._id,
                title: newTopic.title,
                content: newTopic.content,
                author: {
                    id: author._id,
                    name: author.name,
                    title: author.title,
                    company: author.company
                },
                category: {
                    id: '',
                    name: '',
                    slug: ''
                },
                tags: newTopic.tags,
                createdAt: newTopic.createdAt,
                replies: 0,
                views: 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add reply to topic
// Add reply to topic (enhanced)
exports.addReply = async (req, res) => {
    try {
        const { topicId } = req.params;
        const { content } = req.body;

        // Validate content
        if (!content || content.trim().length < 1) {
            return res.status(400).json({ error: 'Reply content is required' });
        }

        if (content.trim().length > 5000) {
            return res.status(400).json({ error: 'Reply content too long (max 5000 characters)' });
        }

        // Check if topic exists and is not locked
        const topic = await Topic.findById(topicId);
        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        if (topic.isLocked) {
            return res.status(403).json({ error: 'Topic is locked and cannot accept new replies' });
        }

        // Create new reply
        const newReply = new Reply({
            content: content.trim(),
            author: req.user.id,
            topic: topicId
        });

        await newReply.save();

        // Update the topic with the reply and update lastActivity
        topic.replies.push(newReply._id);
        topic.lastActivity = new Date();
        await topic.save();

        // Get the reply with author details for response
        const populatedReply = await Reply.findById(newReply._id)
            .populate('author', 'name title company profilePhoto');

        // Helper function to create full photo URL
        const getFullPhotoUrl = (profilePhoto, req) => {
            if (!profilePhoto) return null;
            const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
            return profilePhoto.startsWith('http') ? profilePhoto : `${baseUrl}${profilePhoto}`;
        };

        res.status(201).json({
            message: 'Reply added successfully',
            reply: {
                id: populatedReply._id,
                content: populatedReply.content,
                author: {
                    id: populatedReply.author._id,
                    name: populatedReply.author.name,
                    title: populatedReply.author.title || '',
                    company: populatedReply.author.company || '',
                    profilePhoto: getFullPhotoUrl(populatedReply.author.profilePhoto, req),
                    initials: populatedReply.author.name ? populatedReply.author.name.split(' ')
                        .map(word => word[0])
                        .join('')
                        .toUpperCase()
                        .substring(0, 2) : 'U'
                },
                likes: 0,
                isLikedByUser: false,
                createdAt: populatedReply.createdAt,
                timeAgo: 'Just now'
            }
        });
    } catch (err) {
        console.error('Error adding reply:', err);
        res.status(500).json({ error: err.message });
    }
};

// Like a reply
// Like or unlike a reply (enhanced)
exports.likeReply = async (req, res) => {
    try {
        const { replyId } = req.params;
        const userId = req.user.id;

        const reply = await Reply.findById(replyId);
        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        // Initialize likes array if it doesn't exist
        if (!reply.likes) {
            reply.likes = [];
        }

        // Check if user already liked this reply
        const alreadyLiked = reply.likes.includes(userId);

        if (alreadyLiked) {
            // Unlike
            reply.likes = reply.likes.filter(id => id.toString() !== userId);
        } else {
            // Like
            reply.likes.push(userId);
        }

        await reply.save();

        res.json({
            message: alreadyLiked ? 'Reply unliked' : 'Reply liked',
            liked: !alreadyLiked,
            likesCount: reply.likes.length,
            replyId: reply._id
        });
    } catch (err) {
        console.error('Error liking reply:', err);
        res.status(500).json({ error: err.message });
    }
};

// Get trending tags
exports.getTrendingTags = async (req, res) => {
    try {
        const topics = await Topic.find({}, 'tags');

        // Count tag occurrences
        const tagCounts = {};
        topics.forEach(topic => {
            topic.tags.forEach(tag => {
                if (tagCounts[tag]) {
                    tagCounts[tag]++;
                } else {
                    tagCounts[tag] = 1;
                }
            });
        });

        // Convert to array and sort
        const sortedTags = Object.entries(tagCounts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        res.json(sortedTags);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add Category (Admin only)
exports.addCategory = async (req, res) => {
    try {
        const { name, description, icon } = req.body;

        // Validation
        if (!name) {
            return res.status(400).json({ error: "Category name is required" });
        }

        // Create slug from name
        const slug = name.toLowerCase()
            .replace(/[^\w\s]/gi, '')
            .replace(/\s+/g, '-');

        // Check if category with same slug already exists
        const existingCategory = await Category.findOne({ slug });
        if (existingCategory) {
            return res.status(400).json({ error: "A category with this name already exists" });
        }

        // Get highest order to place new category at the end
        const highestOrder = await Category.findOne().sort('-order');
        const newOrder = highestOrder ? highestOrder.order + 1 : 1;

        // Create new category
        const newCategory = new Category({
            name,
            slug,
            description: description || '',
            icon: icon || 'chat-dots', // Default icon
            isActive: true,
            order: newOrder
        });

        await newCategory.save();

        res.status(201).json({
            message: "Category created successfully",
            category: {
                id: newCategory._id,
                name: newCategory.name,
                slug: newCategory.slug,
                icon: newCategory.icon,
                description: newCategory.description,
                order: newCategory.order,
                topicCount: 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update Category (Admin only)
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, icon, isActive, order } = req.body;

        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Update fields if provided
        if (name) {
            category.name = name;
            // Update slug only if name changes
            category.slug = name.toLowerCase()
                .replace(/[^\w\s]/gi, '')
                .replace(/\s+/g, '-');
        }
        
        if (description !== undefined) category.description = description;
        if (icon !== undefined) category.icon = icon;
        if (isActive !== undefined) category.isActive = isActive;
        if (order !== undefined) category.order = order;

        await category.save();

        // Get topic count
        const topicCount = await Topic.countDocuments({ category: category._id });

        res.json({
            message: "Category updated successfully",
            category: {
                id: category._id,
                name: category.name,
                slug: category.slug,
                icon: category.icon,
                description: category.description,
                order: category.order,
                isActive: category.isActive,
                topicCount
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete Category (Admin only)
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if category has topics
        const topicCount = await Topic.countDocuments({ category: id });
        if (topicCount > 0) {
            return res.status(400).json({ 
                error: "Cannot delete category with existing topics. Move or delete the topics first." 
            });
        }

        await Category.findByIdAndDelete(id);

        res.json({ message: "Category deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Search topics with autocomplete/suggestions
exports.searchTopics = async (req, res) => {
    try {
        const { query, limit = 10, categoryId } = req.query;
        
        if (!query || query.length < 2) {
            return res.json({ results: [] });
        }
        
        const searchQuery = {
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { content: { $regex: query, $options: 'i' } },
                { tags: { $in: [new RegExp(query, 'i')] } }
            ]
        };
        
        // Filter by category if provided
        if (categoryId) {
            searchQuery.category = categoryId;
        }
        
        const topics = await Topic.find(searchQuery)
            .populate('category', 'name slug')
            .populate('author', 'name')
            .sort({ lastActivity: -1 })
            .limit(parseInt(limit));
            
        const results = topics.map(topic => ({
            id: topic._id,
            title: topic.title,
            author: {
                id: topic.author._id,
                name: topic.author.name
            },
            category: {
                id: topic.category._id,
                name: topic.category.name,
                slug: topic.category.slug
            },
            replies: topic.replies.length,
            views: topic.views,
            lastActivity: topic.lastActivity,
            tags: topic.tags
        }));
        
        res.json({ results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get topic filters
exports.getTopicFilters = async (req, res) => {
    try {
        // Get unique categories
        const categories = await Category.find({ isActive: true })
            .select('name slug icon')
            .sort('name');
            
        // Get most used tags
        const topics = await Topic.find({}, 'tags');
        
        // Count tag occurrences
        const tagCounts = {};
        topics.forEach(topic => {
            topic.tags.forEach(tag => {
                if (tagCounts[tag]) {
                    tagCounts[tag]++;
                } else {
                    tagCounts[tag] = 1;
                }
            });
        });
        
        // Convert to array and sort
        const popularTags = Object.entries(tagCounts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15)
            .map(item => item.tag);
        
        res.json({
            categories: categories.map(c => ({
                id: c._id,
                name: c.name,
                slug: c.slug,
                icon: c.icon
            })),
            filters: [
                { id: 'recent', name: 'Recent' },
                { id: 'popular', name: 'Popular' },
                { id: 'unanswered', name: 'Unanswered' }
            ],
            popularTags
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get categories for topic creation form
exports.getTopicFormOptions = async (req, res) => {
    try {
        // Get active categories
        const categories = await Category.find({ isActive: true })
            .select('name slug icon')
            .sort('name');
            
        // Get popular tags for suggestions
        const topics = await Topic.find({}, 'tags');
        
        // Count tag occurrences
        const tagCounts = {};
        topics.forEach(topic => {
            topic.tags.forEach(tag => {
                if (tagCounts[tag]) {
                    tagCounts[tag]++;
                } else {
                    tagCounts[tag] = 1;
                }
            });
        });
        
        // Convert to array and sort
        const suggestedTags = Object.entries(tagCounts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20)
            .map(item => item.tag);
        
        res.json({
            categories: categories.map(c => ({
                id: c._id,
                name: c.name,
                slug: c.slug,
                icon: c.icon
            })),
            suggestedTags
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get topic participants (users who have replied)
exports.getTopicParticipants = async (req, res) => {
    try {
        const { topicId } = req.params;

        const topic = await Topic.findById(topicId)
            .populate('author', 'name title profilePhoto')
            .populate({
                path: 'replies',
                populate: {
                    path: 'author',
                    select: 'name title profilePhoto'
                }
            });

        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        // Get unique participants
        const participantsMap = new Map();
        
        // Add topic author
        participantsMap.set(topic.author._id.toString(), {
            id: topic.author._id,
            name: topic.author.name,
            title: topic.author.title || '',
            profilePhoto: topic.author.profilePhoto,
            role: 'author',
            repliesCount: 0
        });

        // Add reply authors
        topic.replies.forEach(reply => {
            const authorId = reply.author._id.toString();
            if (participantsMap.has(authorId)) {
                participantsMap.get(authorId).repliesCount++;
            } else {
                participantsMap.set(authorId, {
                    id: reply.author._id,
                    name: reply.author.name,
                    title: reply.author.title || '',
                    profilePhoto: reply.author.profilePhoto,
                    role: 'participant',
                    repliesCount: 1
                });
            }
        });

        const participants = Array.from(participantsMap.values());

        res.json({
            totalParticipants: participants.length,
            participants
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Helper function for time formatting
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
    const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    return `${months}mo ago`;
}

// Get recent forum activity for a user
exports.getUserForumActivity = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10 } = req.query;

        // Get user's recent topics
        const userTopics = await Topic.find({ author: userId })
            .populate('category', 'name slug')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) / 2);

        // Get user's recent replies
        const userReplies = await Reply.find({ author: userId })
            .populate('topic', 'title')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) / 2);

        res.json({
            topics: userTopics.map(topic => ({
                id: topic._id,
                title: topic.title,
                category: topic.category,
                replies: topic.replies.length,
                views: topic.views,
                createdAt: topic.createdAt,
                type: 'topic'
            })),
            replies: userReplies.map(reply => ({
                id: reply._id,
                content: reply.content.substring(0, 100) + (reply.content.length > 100 ? '...' : ''),
                topic: reply.topic,
                createdAt: reply.createdAt,
                type: 'reply'
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get forum statistics with dynamic counts and new indicators
exports.getForumStats = async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query; // Default to last 24 hours for "new" indicator
        
        // Calculate timeframe for "new" topics
        const now = new Date();
        let timeframeCutoff;
        
        switch (timeframe) {
            case '1h':
                timeframeCutoff = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                timeframeCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                timeframeCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                timeframeCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                timeframeCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        // Get all active categories with their topic counts and new topic counts
        const categories = await Category.find({ isActive: true }).sort({ order: 1 });

        const statsPromises = categories.map(async (category) => {
            // Get total topic count for this category
            const totalTopics = await Topic.countDocuments({ 
                category: category._id,
                isDeleted: { $ne: true } // Exclude deleted topics if you have soft delete
            });

            // Get new topics count within timeframe
            const newTopics = await Topic.countDocuments({
                category: category._id,
                createdAt: { $gte: timeframeCutoff },
                isDeleted: { $ne: true }
            });

            // Get total replies count for topics in this category
            const topicsInCategory = await Topic.find({ 
                category: category._id,
                isDeleted: { $ne: true }
            }, '_id');
            
            const topicIds = topicsInCategory.map(topic => topic._id);
            
            const totalReplies = await Reply.countDocuments({
                topic: { $in: topicIds },
                isDeleted: { $ne: true }
            });

            // Get new replies count within timeframe
            const newReplies = await Reply.countDocuments({
                topic: { $in: topicIds },
                createdAt: { $gte: timeframeCutoff },
                isDeleted: { $ne: true }
            });

            // Get last activity for this category
            const lastActivity = await Topic.findOne({
                category: category._id,
                isDeleted: { $ne: true }
            }).sort({ lastActivity: -1 }).select('lastActivity');

            return {
                id: category._id,
                name: category.name,
                slug: category.slug,
                icon: category.icon || 'MessageSquare', // Default icon
                description: category.description || `Discussions about ${category.name.toLowerCase()}`,
                color: category.color || '#6366f1',
                stats: {
                    totalTopics,
                    newTopics,
                    totalReplies,
                    newReplies,
                    totalActivity: totalTopics + totalReplies
                },
                display: {
                    topicCount: totalTopics,
                    topicText: totalTopics === 1 ? 'topic' : 'topics',
                    newCount: newTopics + newReplies, // Combined new topics and replies
                    hasNew: (newTopics + newReplies) > 0,
                    lastActivity: lastActivity?.lastActivity || category.updatedAt
                }
            };
        });

        const categoryStats = await Promise.all(statsPromises);

        // Get overall forum statistics
        const overallStats = {
            totalTopics: await Topic.countDocuments({ isDeleted: { $ne: true } }),
            totalReplies: await Reply.countDocuments({ isDeleted: { $ne: true } }),
            totalUsers: await mongoose.model('User').countDocuments(),
            activeUsersToday: await mongoose.model('User').countDocuments({
                lastSeen: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
            }),
            newTopicsToday: await Topic.countDocuments({
                createdAt: { $gte: timeframeCutoff },
                isDeleted: { $ne: true }
            }),
            newRepliesToday: await Reply.countDocuments({
                createdAt: { $gte: timeframeCutoff },
                isDeleted: { $ne: true }
            })
        };

        // Get trending topics (most active in last 24h)
        const trendingTopics = await Topic.aggregate([
            {
                $match: {
                    lastActivity: { $gte: timeframeCutoff },
                    isDeleted: { $ne: true }
                }
            },
            {
                $lookup: {
                    from: 'replies',
                    localField: '_id',
                    foreignField: 'topic',
                    as: 'recentReplies'
                }
            },
            {
                $addFields: {
                    recentActivity: { $size: '$recentReplies' }
                }
            },
            {
                $sort: { recentActivity: -1, views: -1 }
            },
            {
                $limit: 5
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'categoryInfo'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'authorInfo'
                }
            }
        ]);

        res.json({
            categories: categoryStats,
            overallStats,
            trending: trendingTopics.map(topic => ({
                id: topic._id,
                title: topic.title,
                category: topic.categoryInfo[0]?.name || 'General',
                author: topic.authorInfo[0]?.name || 'Unknown',
                replies: topic.replies?.length || 0,
                views: topic.views || 0,
                recentActivity: topic.recentActivity,
                lastActivity: topic.lastActivity
            })),
            meta: {
                timeframe,
                timeframeCutoff,
                lastUpdated: new Date(),
                totalCategories: categories.length
            }
        });

    } catch (err) {
        console.error('Error getting forum stats:', err);
        res.status(500).json({ error: err.message });
    }
};

// Enhanced version of getAllCategories with more detailed stats
exports.getCategoriesWithStats = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ order: 1 });

        const result = await Promise.all(categories.map(async (category) => {
            // Get topic count
            const topicCount = await Topic.countDocuments({ 
                category: category._id,
                isDeleted: { $ne: true }
            });

            // Get new topics in last 24h
            const newTopicsCount = await Topic.countDocuments({
                category: category._id,
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                isDeleted: { $ne: true }
            });

            // Get total replies for this category
            const topicsInCategory = await Topic.find({ 
                category: category._id,
                isDeleted: { $ne: true }
            }, '_id');
            
            const replyCount = await Reply.countDocuments({
                topic: { $in: topicsInCategory.map(t => t._id) },
                isDeleted: { $ne: true }
            });

            // Get new replies in last 24h
            const newRepliesCount = await Reply.countDocuments({
                topic: { $in: topicsInCategory.map(t => t._id) },
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                isDeleted: { $ne: true }
            });

            // Get most recent topic
            const latestTopic = await Topic.findOne({
                category: category._id,
                isDeleted: { $ne: true }
            }).sort({ lastActivity: -1 }).populate('author', 'name');

            return {
                id: category._id,
                name: category.name,
                slug: category.slug,
                icon: category.icon || 'MessageSquare',
                description: category.description,
                color: category.color || '#6366f1',
                topicCount,
                replyCount,
                newCount: newTopicsCount + newRepliesCount,
                hasNew: (newTopicsCount + newRepliesCount) > 0,
                latestTopic: latestTopic ? {
                    id: latestTopic._id,
                    title: latestTopic.title,
                    author: latestTopic.author?.name,
                    lastActivity: latestTopic.lastActivity
                } : null,
                order: category.order
            };
        }));

        res.json(result);
    } catch (err) {
        console.error('Error getting categories with stats:', err);
        res.status(500).json({ error: err.message });
    }
};