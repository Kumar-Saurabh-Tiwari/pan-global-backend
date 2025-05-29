// filepath: d:\CTO Ninja\pan-global-backend\app\controllers\subscribe.controller.js
const Subscribe = require('../models/subscribe.model');
const jwt = require('jsonwebtoken');
const User = require('../../auth/models/user.model');

// Save subscription email
exports.subscribe = async (req, res) => {
    const { email } = req.body;
    try {
        const newSubscription = new Subscribe({ email });
        await newSubscription.save();
        res.status(201).json({ message: "Email subscribed successfully" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Get all subscribed emails
exports.getSubscribers = async (req, res) => {
    try {
        const subscribers = await Subscribe.find();
        res.json(subscribers);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Middleware to protect routes
exports.verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).send("A token is required for authentication");

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).send("Invalid Token");
        req.user = decoded;
        next();
    });
};