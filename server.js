const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authMiddleware = require('./auth/middleware/auth.middleware');
require('dotenv').config();

const app = express();
connectDB();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Auth routes - public
app.use('/api/auth', require('./auth/routes/auth.route'));

// Protected routes
app.use('/api', authMiddleware.verifyToken, require('./app/routes/dashboard.route'));
app.use('/api', authMiddleware.verifyToken, require('./app/routes/membership.route'));
app.use('/api', authMiddleware.verifyToken, require('./app/routes/event.route'));
app.use('/api', authMiddleware.verifyToken, require('./app/routes/resource.route'));
app.use('/api', authMiddleware.verifyToken, require('./app/routes/subscribe.route'));
app.use('/api', authMiddleware.verifyToken, require('./app/routes/contact.route'));
app.use('/api', authMiddleware.verifyToken, require('./app/routes/network.route'));
app.use('/api', authMiddleware.verifyToken, require('./app/routes/forum.route'));
app.use('/api', authMiddleware.verifyToken, require('./app/routes/globalAccess.route'));
app.use('/api', authMiddleware.verifyToken, require('./app/routes/memberBenefits.route'));
app.use('/api/settings', authMiddleware.verifyToken, require('./app/routes/settings.route'));


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});