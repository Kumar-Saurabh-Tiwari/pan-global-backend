const mongoose = require('mongoose');

const GlobalAccessSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
    visitDate: { type: Date, default: Date.now },
    accessType: { type: String, enum: ['physical', 'virtual'], default: 'physical' }
}, { timestamps: true });

module.exports = mongoose.model('GlobalAccess', GlobalAccessSchema);