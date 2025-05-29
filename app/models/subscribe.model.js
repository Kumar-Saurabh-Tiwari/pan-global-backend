// filepath: d:\CTO Ninja\pan-global-backend\app\models\subscribe.model.js
const mongoose = require('mongoose');

const SubscribeSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
}, { timestamps: true });

module.exports = mongoose.model('Subscribe', SubscribeSchema);