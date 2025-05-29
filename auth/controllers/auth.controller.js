const User = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Add this line

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user._id, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.logout = (req, res) => {
    // Client-side token removal is typically handled by the frontend
    res.json({ message: "Logged out successfully" });
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            // For security, don't reveal whether the email exists or not
            return res.status(200).json({ 
                message: "If this email is registered, reset instructions will be sent" 
            });
        }
        
        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString('hex');
        
        // Set token and expiration (1 hour)
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        
        await user.save();
        
        // In a production environment, send an email with the reset link
        // For this example, we'll just return the token in the response
        
        // const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        // await sendPasswordResetEmail(user.email, resetLink);
        
        res.json({ 
            message: "Password reset instructions sent",
            // Only include token in development, remove for production
            resetToken,
            resetLink: `${process.env.FRONTEND_URL || 'https://panglobal.network'}/reset-password/${resetToken}`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        
        if (!token || !password) {
            return res.status(400).json({ error: "Token and new password are required" });
        }
        
        // Find user with this token and ensure it hasn't expired
        const user = await User.findOne({ 
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({ error: "Invalid or expired reset token" });
        }
        
        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        
        // Clear the reset token and expiration
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        
        await user.save();
        
        res.json({ message: "Password reset successful" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.register = async (req, res) => {
    const { name, email, password, title, company } = req.body;
    
    try {
        // Input validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Please provide name, email, and password" });
        }
        
        // Check for existing user
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ error: "User with this email already exists" });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            title: title || '',
            company: company || '',
            memberType: 'basic'
        });
        
        await newUser.save();
        
        // Generate JWT token
        const token = jwt.sign(
            { id: newUser._id, email: newUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        // Return success with token and user data
        res.status(201).json({
            message: "Registration successful",
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};