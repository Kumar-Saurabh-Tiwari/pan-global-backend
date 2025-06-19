const mongoose = require('mongoose');

const ConnectionSchema = new mongoose.Schema({
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    
    // Relationship Management Fields
    relationshipStrength: {
        type: String,
        enum: ['new', 'developing', 'strong', 'key'],
        default: 'new'
    },
    
    communicationPreference: {
        type: String,
        enum: ['email', 'phone', 'meeting'],
        default: 'email'
    },
    
    lastContact: { type: Date },
    lastCommunicationType: {
        type: String,
        enum: ['email', 'phone', 'meeting', 'event']
    },
    
    nextFollowUp: { type: Date },
    
    notes: { type: String },
    
    tags: [{ type: String }],
    
    // Communication History
    communicationHistory: [{
        type: {
            type: String,
            enum: ['email', 'phone', 'meeting', 'event'],
            required: true
        },
        date: { type: Date, required: true },
        notes: { type: String },
        loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    }],
    
    lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

// Create compound index to prevent duplicate connections
ConnectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Indexes for relationship management queries
ConnectionSchema.index({ nextFollowUp: 1 });
ConnectionSchema.index({ lastContact: 1 });
ConnectionSchema.index({ relationshipStrength: 1 });
ConnectionSchema.index({ tags: 1 });

module.exports = mongoose.model('Connection', ConnectionSchema);