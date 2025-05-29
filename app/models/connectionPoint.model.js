const mongoose = require('mongoose');

const ConnectionPointSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    total: { type: Number, default: 0 },
    history: [
        {
            month: { type: String },
            total: { type: Number }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('ConnectionPoint', ConnectionPointSchema);