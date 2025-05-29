const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

exports.verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: 'Invalid token.' });
    }
};

exports.isAdmin = async (req, res, next) => {
    try {
        // We should already have req.user.id from the verifyToken middleware
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Check if user has admin role
        // You may need to adjust this check depending on how roles are stored in your user model
        if (!user.role || user.role !== 'admin') {
            return res.status(403).json({ 
                error: "Access denied: Admin privileges required for this operation" 
            });
        }
        
        // User is an admin, proceed to next middleware
        next();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};