const mongoose = require('mongoose');

// Category Schema
const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    icon: { type: String }, // Icon name/class for the category
    description: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    topicsCount: { type: Number, default: 0 }, // Cache topic count for performance
    color: { type: String, default: '#6366f1' } // Category color for UI
}, { timestamps: true });

// Topic Schema
const TopicSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Fix: Changed from String to ObjectId to properly reference Category
    category: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category',
        default: null // Allow null for uncategorized topics
    },
    tags: [{ type: String }],
    replies: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Reply' 
    }],
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Add likes for topics
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Add bookmarks
    isPinned: { type: Boolean, default: false },
    isPopular: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    isClosed: { type: Boolean, default: false }, // Add closed status
    lastActivity: { type: Date, default: Date.now },
    lastReplyAt: { type: Date }, // Track when last reply was added
    lastReplyBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Track who replied last
}, { timestamps: true });

// Reply Schema
const ReplySchema = new mongoose.Schema({
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Add reply to reply functionality (nested replies)
    parentReply: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Reply',
        default: null 
    },
    // Add mention functionality
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Add edit tracking
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    // Add reply status
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Add indexes for better performance
CategorySchema.index({ slug: 1 });
CategorySchema.index({ isActive: 1, order: 1 });

TopicSchema.index({ category: 1, lastActivity: -1 });
TopicSchema.index({ author: 1, createdAt: -1 });
TopicSchema.index({ tags: 1 });
TopicSchema.index({ title: 'text', content: 'text' }); // Text search index

ReplySchema.index({ topic: 1, createdAt: 1 });
ReplySchema.index({ author: 1, createdAt: -1 });
ReplySchema.index({ parentReply: 1 });

// Add middleware to update topic's lastActivity when reply is added
ReplySchema.post('save', async function() {
    if (this.isNew && !this.isDeleted) {
        await mongoose.model('Topic').findByIdAndUpdate(
            this.topic,
            { 
                lastActivity: new Date(),
                lastReplyAt: new Date(),
                lastReplyBy: this.author
            }
        );
        
        // Update category topics count
        const topic = await mongoose.model('Topic').findById(this.topic);
        if (topic && topic.category) {
            await mongoose.model('Category').findByIdAndUpdate(
                topic.category,
                { $inc: { topicsCount: 0 } } // Don't increment for replies, just for new topics
            );
        }
    }
});

// Add middleware to update category topics count when topic is created
TopicSchema.post('save', async function() {
    if (this.isNew && this.category) {
        await mongoose.model('Category').findByIdAndUpdate(
            this.category,
            { $inc: { topicsCount: 1 } }
        );
    }
});

// Add middleware to update category topics count when topic is deleted
TopicSchema.post('findOneAndDelete', async function(doc) {
    if (doc && doc.category) {
        await mongoose.model('Category').findByIdAndUpdate(
            doc.category,
            { $inc: { topicsCount: -1 } }
        );
    }
});

const Category = mongoose.model('Category', CategorySchema);
const Topic = mongoose.model('Topic', TopicSchema);
const Reply = mongoose.model('Reply', ReplySchema);

module.exports = { Category, Topic, Reply };