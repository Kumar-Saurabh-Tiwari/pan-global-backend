const mongoose = require('mongoose');

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
    accessedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Resource', ResourceSchema);