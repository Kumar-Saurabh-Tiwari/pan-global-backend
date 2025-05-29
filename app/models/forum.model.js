const mongoose = require('mongoose');

// Category Schema
const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    icon: { type: String }, // Icon name/class for the category
    description: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Topic Schema
const TopicSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    tags: [{ type: String }],
    replies: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Reply' 
    }],
    views: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
    isPopular: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

// Reply Schema
const ReplySchema = new mongoose.Schema({
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const Category = mongoose.model('Category', CategorySchema);
const Topic = mongoose.model('Topic', TopicSchema);
const Reply = mongoose.model('Reply', ReplySchema);

module.exports = { Category, Topic, Reply };