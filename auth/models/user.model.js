const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePhoto: { type: String },
    title: { type: String },
    company: { type: String },
    bio: { type: String },
    phone: { type: String },
    location: { type: String },
    linkedin: { type: String },
    twitter: { type: String },
    industry: { type: String },
    chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    lastActive: { type: Date, default: Date.now },
    memberType: { type: String, default: 'basic' },
    membershipExpiry: { type: Date },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    role: {
        type: String,
        enum: ['user', 'admin', 'moderator'],
        default: 'user'
    },
    notificationPreferences: {
        email: { type: Boolean, default: true },
        app: { type: Boolean, default: true },
        events: { type: Boolean, default: true },
        connections: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false }
    },
    privacySettings: {
        profileVisibility: { type: String, enum: ['public', 'members', 'connections'], default: 'members' },
        showEmail: { type: Boolean, default: false },
        showPhone: { type: Boolean, default: false },
        allowMessaging: { type: Boolean, default: true }
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);