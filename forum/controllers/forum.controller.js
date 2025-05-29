const { Category, Topic, Reply } = require('../../app/models/forum.model');
const User = require('../../auth/models/user.model');

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
            author: {
                id: topic.author._id,
                name: topic.author.name
            },
            category: {
                id: topic.category._id,
                name: topic.category.name,
                slug: topic.category.slug
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
        res.status(500).json({ error: err.message });
    }
};

// Get single topic with replies
exports.getTopic = async (req, res) => {
    try {
        const topicId = req.params.id;

        // Find the topic and increment view count
        const topic = await Topic.findByIdAndUpdate(
            topicId,
            { $inc: { views: 1 } },
            { new: true }
        )
            .populate('author', 'name title company')
            .populate('category', 'name slug')
            .populate({
                path: 'replies',
                populate: {
                    path: 'author',
                    select: 'name title company'
                }
            });

        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        // Format the response
        const formattedTopic = {
            id: topic._id,
            title: topic.title,
            content: topic.content,
            author: {
                id: topic.author._id,
                name: topic.author.name,
                title: topic.author.title,
                company: topic.author.company
            },
            category: {
                id: topic.category._id,
                name: topic.category.name,
                slug: topic.category.slug
            },
            tags: topic.tags,
            views: topic.views,
            createdAt: topic.createdAt,
            lastActivity: topic.lastActivity,
            isPinned: topic.isPinned,
            isLocked: topic.isLocked,
            replies: topic.replies.map(reply => ({
                id: reply._id,
                content: reply.content,
                author: {
                    id: reply.author._id,
                    name: reply.author.name,
                    title: reply.author.title,
                    company: reply.author.company
                },
                likes: reply.likes.length,
                createdAt: reply.createdAt
            }))
        };

        res.json(formattedTopic);
    } catch (err) {
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
        
        if (!categoryId) {
            return res.status(400).json({ error: 'Category is required' });
        }
        
        // Check if category exists
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
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
            category: categoryId,
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
                    id: category._id,
                    name: category.name,
                    slug: category.slug
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
exports.addReply = async (req, res) => {
    try {
        const { topicId } = req.params;
        const { content } = req.body;

        // Check if topic exists and is not locked
        const topic = await Topic.findById(topicId);
        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        if (topic.isLocked) {
            return res.status(403).json({ error: 'Topic is locked' });
        }

        // Create new reply
        const newReply = new Reply({
            content,
            author: req.user.id,
            topic: topicId
        });

        await newReply.save();

        // Update the topic with the reply and update lastActivity
        topic.replies.push(newReply._id);
        topic.lastActivity = new Date();
        await topic.save();

        res.status(201).json({
            message: 'Reply added successfully',
            replyId: newReply._id
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Like a reply
exports.likeReply = async (req, res) => {
    try {
        const { replyId } = req.params;

        const reply = await Reply.findById(replyId);
        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        // Check if user already liked this reply
        const alreadyLiked = reply.likes.includes(req.user.id);

        if (alreadyLiked) {
            // Unlike
            reply.likes = reply.likes.filter(id => id.toString() !== req.user.id);
        } else {
            // Like
            reply.likes.push(req.user.id);
        }

        await reply.save();

        res.json({
            message: alreadyLiked ? 'Reply unliked' : 'Reply liked',
            likes: reply.likes.length
        });
    } catch (err) {
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