const User = require('../../auth/models/user.model');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Get user profile
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update profile information
exports.updateProfile = async (req, res) => {
    try {
        const { name, title, company, bio, phone, location, linkedin, twitter } = req.body;
        
        // Find user and update
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            {
                name,
                title,
                company,
                bio,
                phone,
                location,
                linkedin,
                twitter
            },
            { new: true }
        ).select('-password');
        
        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.json({
            message: "Profile updated successfully",
            user: updatedUser
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update profile photo
exports.updateProfilePhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        
        // Create photos directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../../public/uploads/profile-photos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        // Generate unique filename
        const filename = `${req.user.id}-${Date.now()}${path.extname(req.file.originalname)}`;
        const filepath = path.join(uploadDir, filename);
        
        // Save file
        fs.writeFileSync(filepath, req.file.buffer);
        
        // Update user profile with new photo URL
        const photoUrl = `${filename}`;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { profilePhoto: photoUrl },
            { new: true }
        ).select('-password');
        
        res.json({
            message: "Profile photo updated successfully",
            photoUrl,
            user: updatedUser
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Validate request
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Both current and new password are required" });
        }
        
        // Find user
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Check if current password is correct
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Current password is incorrect" });
        }
        
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        
        await user.save();
        
        res.json({ message: "Password changed successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update notification preferences
exports.updateNotifications = async (req, res) => {
    try {
        const { email, app, events, connections, marketing } = req.body;
        
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            {
                notificationPreferences: {
                    email: email !== undefined ? email : true,
                    app: app !== undefined ? app : true,
                    events: events !== undefined ? events : true,
                    connections: connections !== undefined ? connections : true,
                    marketing: marketing !== undefined ? marketing : false
                }
            },
            { new: true }
        ).select('-password');
        
        res.json({
            message: "Notification preferences updated successfully",
            notificationPreferences: updatedUser.notificationPreferences
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update privacy settings
exports.updatePrivacy = async (req, res) => {
    try {
        const { profileVisibility, showEmail, showPhone, allowMessaging } = req.body;
        
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            {
                privacySettings: {
                    profileVisibility: profileVisibility || 'members',
                    showEmail: showEmail !== undefined ? showEmail : false,
                    showPhone: showPhone !== undefined ? showPhone : false,
                    allowMessaging: allowMessaging !== undefined ? allowMessaging : true
                }
            },
            { new: true }
        ).select('-password');
        
        res.json({
            message: "Privacy settings updated successfully",
            privacySettings: updatedUser.privacySettings
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};