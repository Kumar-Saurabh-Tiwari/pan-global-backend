const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
    name: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    address: { type: String },
    region: { 
        type: String,
        enum: ['Americas', 'Europe & Middle East', 'Asia Pacific', 'Africa']
    },
    status: {
        type: String,
        enum: ['Active', 'Coming Soon', 'Planned'],
        default: 'Active'
    },
    coordinates: {
        lat: { type: Number },
        lng: { type: Number }
    },
    amenities: [{ type: String }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    eventsPerMonth: { type: Number, default: 0 },
    photo: { type: String },
    description: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },
    openingHours: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chapter', ChapterSchema);