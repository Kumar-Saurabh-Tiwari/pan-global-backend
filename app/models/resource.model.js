const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    userAvatar: {
        type: String,
        default: null
    },
    comment: {
        type: String,
        required: true,
        maxlength: 1000
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    replies: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        userName: String,
        userAvatar: String,
        reply: {
            type: String,
            required: true,
            maxlength: 500
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
});

const ResourceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    content: { type: String },
    category: { type: String, required: true },
    author: { type: String },
    publishDate: { type: Date, default: Date.now },
    resourceType: {
        type: String,
        required: true,
        enum: ['article', 'video', 'webinar', 'whitepaper', 'guide', 'template', 'toolkit', 'presentation']
    },
    level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'intermediate'
    },
    isExclusive: { type: Boolean, default: false },
    readTime: { type: Number }, // In minutes, for articles/documents
    duration: { type: Number }, // In minutes, for videos/webinars
    tags: [{ type: String }],
    imageUrl: { type: String },
    downloadUrl: { type: String },
    videoUrl: {
        type: String,
        default: null
    },
    views: {
        type: Number,
        default: 0
    },
    downloads: {
        type: Number,
        default: 0
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Enhanced comments system
    comments: [CommentSchema],
    commentCount: {
        type: Number,
        default: 0
    },
    // Array to store people who commented (for quick access)
    commenters: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        userName: String,
        userAvatar: String,
        lastCommentDate: {
            type: Date,
            default: Date.now
        },
        commentCount: {
            type: Number,
            default: 1
        }
    }],
    author: {
        name: String,
        title: String,
        avatar: String
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    accessedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

// Index for better query performance
ResourceSchema.index({ 'comments.createdAt': -1 });
ResourceSchema.index({ 'commenters.userId': 1 });
ResourceSchema.index({ commentCount: -1 });

module.exports = mongoose.model('Resource', ResourceSchema);