const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    shortDescription: { type: String },
    date: { type: Date, required: true },
    time: { type: String },
    duration: { type: Number }, // in minutes
    location: { type: String },
    virtualLink: { type: String },
    eventType: { 
        type: String, 
        enum: ['virtual', 'in-person', 'hybrid'],
        required: true 
    },
    eventFormat: { 
        type: String,
        enum: ['workshop', 'seminar', 'networking', 'conference', 'roundtable', 'webinar', 'other']
    },
    capacity: { type: Number },
    price: { type: Number, default: 0 },
    imageUrl: { type: String },
    isFeatured: { type: Boolean, default: false },
    chapters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }],
    speakers: [{
        name: { type: String },
        title: { type: String },
        company: { type: String },
        bio: { type: String },
        imageUrl: { type: String }
    }],
    sponsors: [{
        name: { type: String },
        logoUrl: { type: String },
        website: { type: String }
    }],
    agenda: [{
        time: { type: String },
        title: { type: String },
        description: { type: String },
        speaker: { type: String }
    }],
    tags: [{ type: String }],
    attendees: [{ 
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        registeredAt: { type: Date, default: Date.now },
        status: { 
            type: String, 
            enum: ['confirmed', 'waitlist', 'cancelled'],
            default: 'confirmed'
        }
    }],
    registrationCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Event', EventSchema);