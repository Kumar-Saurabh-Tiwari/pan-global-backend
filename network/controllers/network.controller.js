const Connection = require('../../app/models/connection.model');
const Chapter = require('../../app/models/chapter.model');
const User = require('../../auth/models/user.model');
const { UserMembership } = require('../../app/models/memberBenefits');

// Get network overview stats (Enhanced for relationship management)
exports.getNetworkStats = async (req, res) => {
    try {
        // Total members (accepted connections)
        const totalConnections = await Connection.countDocuments({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ]
        });

        // Follow-ups due (connections with nextFollowUp <= today)
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        
        const followUpsDue = await Connection.countDocuments({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ],
            nextFollowUp: { $lte: today }
        });

        // Recent contacts (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentContacts = await Connection.countDocuments({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ],
            lastContact: { $gte: sevenDaysAgo }
        });

        // Key relationships
        const keyRelationships = await Connection.countDocuments({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ],
            relationshipStrength: 'key'
        });

        res.json({
            totalMembers: totalConnections,
            followUpsDue,
            recentContacts,
            keyRelationships
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get all network members with relationship management data
exports.getAllMembers = async (req, res) => {
    try {
        const {
            search = '',
            chapter = 'all',
            industry = 'all',
            relationship = 'all',
            page = 1,
            limit = 20
        } = req.query;

        // Get all connections
        const connections = await Connection.find({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ]
        }).populate({
            path: 'requester recipient',
            select: 'name title company industry location chapter expertise bio profilePhoto'
        }).populate({
            path: 'requester.chapter recipient.chapter',
            select: 'name city country'
        });

        // Format members with relationship data
        let members = connections.map(connection => {
            const member = connection.requester._id.toString() === req.user.id ? 
                connection.recipient : connection.requester;
            
            return {
                id: member._id,
                connectionId: connection._id,
                name: member.name,
                title: member.title || '',
                company: member.company || '',
                industry: member.industry || '',
                location: member.location || '',
                chapter: member.chapter ? member.chapter.name : '',
                expertise: member.expertise || [],
                avatar: member.profilePhoto,
                lastContact: connection.lastContact,
                nextFollowUp: connection.nextFollowUp,
                communicationPreference: connection.communicationPreference || 'email',
                relationshipStrength: connection.relationshipStrength || 'new',
                notes: connection.notes || '',
                tags: connection.tags || [],
                joinDate: connection.createdAt,
                availability: member.availability || 'available'
            };
        });

        // Apply filters
        if (search) {
            const searchLower = search.toLowerCase();
            members = members.filter(member =>
                member.name.toLowerCase().includes(searchLower) ||
                member.company.toLowerCase().includes(searchLower) ||
                member.industry.toLowerCase().includes(searchLower) ||
                member.expertise.some(exp => exp.toLowerCase().includes(searchLower))
            );
        }

        if (chapter !== 'all') {
            members = members.filter(member => member.chapter === chapter);
        }

        if (industry !== 'all') {
            members = members.filter(member => member.industry === industry);
        }

        if (relationship !== 'all') {
            members = members.filter(member => member.relationshipStrength === relationship);
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedMembers = members.slice(skip, skip + parseInt(limit));

        res.json({
            members: paginatedMembers,
            pagination: {
                total: members.length,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(members.length / parseInt(limit))
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get members with follow-ups due
exports.getFollowUpsDue = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const connections = await Connection.find({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ],
            nextFollowUp: { $lte: today }
        }).populate({
            path: 'requester recipient',
            select: 'name title company profilePhoto'
        });

        const followUpMembers = connections.map(connection => {
            const member = connection.requester._id.toString() === req.user.id ? 
                connection.recipient : connection.requester;
            
            return {
                id: member._id,
                connectionId: connection._id,
                name: member.name,
                title: member.title,
                company: member.company,
                avatar: member.profilePhoto,
                nextFollowUp: connection.nextFollowUp,
                relationshipStrength: connection.relationshipStrength || 'new',
                notes: connection.notes
            };
        });

        res.json({ members: followUpMembers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update relationship data (follow-up, notes, strength, etc.)
exports.updateRelationship = async (req, res) => {
    try {
        const { connectionId } = req.params;
        const {
            nextFollowUp,
            notes,
            relationshipStrength,
            communicationPreference,
            tags
        } = req.body;

        const connection = await Connection.findById(connectionId);
        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }

        // Verify user owns this connection
        if (connection.requester.toString() !== req.user.id && 
            connection.recipient.toString() !== req.user.id) {
            return res.status(403).json({ error: "Not authorized to update this connection" });
        }

        // Update fields
        if (nextFollowUp !== undefined) connection.nextFollowUp = nextFollowUp ? new Date(nextFollowUp) : null;
        if (notes !== undefined) connection.notes = notes;
        if (relationshipStrength !== undefined) connection.relationshipStrength = relationshipStrength;
        if (communicationPreference !== undefined) connection.communicationPreference = communicationPreference;
        if (tags !== undefined) connection.tags = tags;

        await connection.save();

        res.json({ 
            message: "Relationship updated successfully",
            connection: {
                id: connection._id,
                nextFollowUp: connection.nextFollowUp,
                notes: connection.notes,
                relationshipStrength: connection.relationshipStrength,
                communicationPreference: connection.communicationPreference,
                tags: connection.tags
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Log communication with a member
exports.logCommunication = async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { type, notes, followUpDate } = req.body;

        const connection = await Connection.findById(connectionId);
        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }

        // Verify user owns this connection
        if (connection.requester.toString() !== req.user.id && 
            connection.recipient.toString() !== req.user.id) {
            return res.status(403).json({ error: "Not authorized to update this connection" });
        }

        // Update last contact and communication log
        connection.lastContact = new Date();
        connection.lastCommunicationType = type;
        
        if (followUpDate) {
            connection.nextFollowUp = new Date(followUpDate);
        }

        // Add to communication history
        if (!connection.communicationHistory) {
            connection.communicationHistory = [];
        }
        
        connection.communicationHistory.push({
            type,
            date: new Date(),
            notes: notes || '',
            loggedBy: req.user.id
        });

        await connection.save();

        res.json({ 
            message: "Communication logged successfully",
            lastContact: connection.lastContact,
            nextFollowUp: connection.nextFollowUp
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get recent communications
exports.getRecentCommunications = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const connections = await Connection.find({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ],
            lastContact: { $gte: sevenDaysAgo }
        }).populate({
            path: 'requester recipient',
            select: 'name title company profilePhoto'
        }).sort({ lastContact: -1 }).limit(parseInt(limit));

        const recentContacts = connections.map(connection => {
            const member = connection.requester._id.toString() === req.user.id ? 
                connection.recipient : connection.requester;
            
            return {
                id: member._id,
                connectionId: connection._id,
                name: member.name,
                title: member.title,
                company: member.company,
                avatar: member.profilePhoto,
                lastContact: connection.lastContact,
                lastCommunicationType: connection.lastCommunicationType,
                relationshipStrength: connection.relationshipStrength
            };
        });

        res.json({ members: recentContacts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get key relationships
exports.getKeyRelationships = async (req, res) => {
    try {
        const connections = await Connection.find({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ],
            relationshipStrength: 'key'
        }).populate({
            path: 'requester recipient',
            select: 'name title company industry profilePhoto expertise'
        });

        const keyMembers = connections.map(connection => {
            const member = connection.requester._id.toString() === req.user.id ? 
                connection.recipient : connection.requester;
            
            return {
                id: member._id,
                connectionId: connection._id,
                name: member.name,
                title: member.title,
                company: member.company,
                industry: member.industry,
                expertise: member.expertise || [],
                avatar: member.profilePhoto,
                lastContact: connection.lastContact,
                nextFollowUp: connection.nextFollowUp,
                notes: connection.notes,
                tags: connection.tags || []
            };
        });

        res.json({ members: keyMembers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get available chapters for filter
exports.getChapters = async (req, res) => {
    try {
        const chapters = await Chapter.find({ status: 'Active' })
            .select('name city country')
            .sort({ name: 1 });

        res.json({ chapters });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get available industries for filter
exports.getIndustries = async (req, res) => {
    try {
        // Get unique industries from connected users
        const connections = await Connection.find({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ]
        }).populate({
            path: 'requester recipient',
            select: 'industry'
        });

        const industries = [...new Set(
            connections.map(conn => {
                const member = conn.requester._id.toString() === req.user.id ? 
                    conn.recipient : conn.requester;
                return member.industry;
            }).filter(industry => industry && industry.trim() !== '')
        )].sort();

        res.json({ industries });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Schedule follow-up for a member
exports.scheduleFollowUp = async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { followUpDate, notes } = req.body;

        if (!followUpDate) {
            return res.status(400).json({ error: "Follow-up date is required" });
        }

        const connection = await Connection.findById(connectionId);
        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }

        // Verify user owns this connection
        if (connection.requester.toString() !== req.user.id && 
            connection.recipient.toString() !== req.user.id) {
            return res.status(403).json({ error: "Not authorized to update this connection" });
        }

        connection.nextFollowUp = new Date(followUpDate);
        if (notes) {
            connection.notes = notes;
        }

        await connection.save();

        res.json({ 
            message: "Follow-up scheduled successfully",
            nextFollowUp: connection.nextFollowUp
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Add note to a member relationship
exports.addNote = async (req, res) => {
    try {
        const { connectionId } = req.params;
        const { note } = req.body;

        if (!note || note.trim() === '') {
            return res.status(400).json({ error: "Note content is required" });
        }

        const connection = await Connection.findById(connectionId);
        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }

        // Verify user owns this connection
        if (connection.requester.toString() !== req.user.id && 
            connection.recipient.toString() !== req.user.id) {
            return res.status(403).json({ error: "Not authorized to update this connection" });
        }

        // Add note to existing notes or create new
        const timestamp = new Date().toISOString().split('T')[0];
        const noteEntry = `[${timestamp}] ${note.trim()}`;
        
        connection.notes = connection.notes ? 
            `${connection.notes}\n\n${noteEntry}` : 
            noteEntry;

        await connection.save();

        res.json({ 
            message: "Note added successfully",
            notes: connection.notes
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Keep existing functions for backward compatibility
exports.getMyConnections = async (req, res) => {
    // Redirect to getAllMembers for consistency
    req.query.limit = req.query.limit || 50;
    return exports.getAllMembers(req, res);
};

// Get my connections
exports.getMyConnections = async (req, res) => {
    try {
        const connections = await Connection.find({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ]
        }).populate({
            path: 'requester recipient',
            select: 'name title company industry lastActive'
        });

        // Format the connections
        const formattedConnections = connections.map(connection => {
            const connectionUser = connection.requester._id.toString() === req.user.id ? 
                connection.recipient : connection.requester;
            
            return {
                id: connectionUser._id,
                name: connectionUser.name,
                title: connectionUser.title,
                company: connectionUser.company,
                industry: connectionUser.industry,
                lastActive: connectionUser.lastActive,
                mutualConnections: 0, // This would be calculated in a real implementation
                connectionDate: connection.updatedAt
            };
        });

        res.json({
            connections: formattedConnections
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get pending connection requests
exports.getPendingRequests = async (req, res) => {
    try {
        const pendingRequests = await Connection.find({
            recipient: req.user.id,
            status: 'pending'
        }).populate({
            path: 'requester',
            select: 'name title company industry lastActive'
        });

        const formattedRequests = pendingRequests.map(request => ({
            id: request._id,
            user: {
                id: request.requester._id,
                name: request.requester.name,
                title: request.requester.title,
                company: request.requester.company,
                industry: request.requester.industry
            },
            requestDate: request.createdAt
        }));

        res.json(formattedRequests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get chapter members
exports.getChapterMembers = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.chapter) {
            return res.json({ members: [] });
        }

        const chapter = await Chapter.findById(user.chapter).populate({
            path: 'members',
            select: 'name title company industry lastActive'
        });

        if (!chapter) {
            return res.json({ members: [] });
        }

        const members = chapter.members.filter(member =>
            member._id.toString() !== req.user.id
        ).map(member => ({
            id: member._id,
            name: member.name,
            title: member.title,
            company: member.company,
            industry: member.industry,
            lastActive: member.lastActive
        }));

        res.json({
            members
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Send connection request
exports.sendConnectionRequest = async (req, res) => {
    try {
        const { recipientId } = req.body;
        
        // Prevent self-connection
        if (recipientId === req.user.id) {
            return res.status(400).json({ error: "Cannot connect to yourself" });
        }

        // Check if connection already exists
        const existingConnection = await Connection.findOne({
            $or: [
                { requester: req.user.id, recipient: recipientId },
                { requester: recipientId, recipient: req.user.id }
            ]
        });

        if (existingConnection) {
            return res.status(400).json({ error: "Connection already exists" });
        }

        // Create new connection request
        const newConnection = new Connection({
            requester: req.user.id,
            recipient: recipientId
        });

        await newConnection.save();
        res.status(201).json({ message: "Connection request sent" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Accept connection request
exports.acceptConnectionRequest = async (req, res) => {
    try {
        const { connectionId } = req.params;
        
        const connection = await Connection.findById(connectionId);
        if (!connection) {
            return res.status(404).json({ error: "Connection request not found" });
        }

        // Ensure the user is the recipient of this request
        if (connection.recipient.toString() !== req.user.id) {
            return res.status(403).json({ error: "Not authorized to accept this request" });
        }

        connection.status = 'accepted';
        connection.lastActivity = new Date();
        await connection.save();

        res.json({ message: "Connection request accepted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Reject connection request
exports.rejectConnectionRequest = async (req, res) => {
    try {
        const { connectionId } = req.params;
        
        const connection = await Connection.findById(connectionId);
        if (!connection) {
            return res.status(404).json({ error: "Connection request not found" });
        }

        // Ensure the user is the recipient of this request
        if (connection.recipient.toString() !== req.user.id) {
            return res.status(403).json({ error: "Not authorized to reject this request" });
        }

        connection.status = 'rejected';
        await connection.save();

        res.json({ message: "Connection request rejected" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Remove connection
exports.removeConnection = async (req, res) => {
    try {
        const { connectionId } = req.params;
        
        await Connection.findByIdAndDelete(connectionId);
        
        res.json({ message: "Connection removed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Search network connections
exports.searchConnections = async (req, res) => {
    try {
        const { query } = req.query;
        
        const connections = await Connection.find({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ]
        }).populate({
            path: 'requester recipient',
            select: 'name title company industry'
        });

        // Filter connections by search query
        const filteredConnections = connections.filter(connection => {
            const connectionUser = connection.requester._id.toString() === req.user.id ? 
                connection.recipient : connection.requester;
            
            const searchableString = `${connectionUser.name} ${connectionUser.title} ${connectionUser.company} ${connectionUser.industry}`.toLowerCase();
            return searchableString.includes(query.toLowerCase());
        });

        const formattedConnections = filteredConnections.map(connection => {
            const connectionUser = connection.requester._id.toString() === req.user.id ? 
                connection.recipient : connection.requester;
            
            return {
                id: connectionUser._id,
                name: connectionUser.name,
                title: connectionUser.title,
                company: connectionUser.company,
                industry: connectionUser.industry,
                connectionDate: connection.updatedAt
            };
        });

        res.json(formattedConnections);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Create new direct connection (admin only)
exports.createDirectConnection = async (req, res) => {
    try {
        const { userId1, userId2, notes } = req.body;
        
        // Validate input
        if (!userId1 || !userId2) {
            return res.status(400).json({ error: "Both user IDs are required" });
        }
        
        // Prevent self-connection
        if (userId1 === userId2) {
            return res.status(400).json({ error: "Cannot connect a user to themselves" });
        }
        
        // Check if users exist
        const user1 = await User.findById(userId1);
        const user2 = await User.findById(userId2);
        
        if (!user1 || !user2) {
            return res.status(404).json({ error: "One or both users not found" });
        }
        
        // Check if connection already exists
        const existingConnection = await Connection.findOne({
            $or: [
                { requester: userId1, recipient: userId2 },
                { requester: userId2, recipient: userId1 }
            ]
        });
        
        if (existingConnection) {
            return res.status(400).json({ 
                error: "Connection already exists", 
                status: existingConnection.status 
            });
        }
        
        // Create new direct connection
        const newConnection = new Connection({
            requester: userId1,
            recipient: userId2,
            status: 'accepted', // Direct creation as accepted
            notes: notes || '',
            lastActivity: new Date()
        });
        
        await newConnection.save();
        
        res.status(201).json({ 
            message: "Connection created successfully",
            connection: {
                id: newConnection._id,
                user1: {
                    id: user1._id,
                    name: user1.name
                },
                user2: {
                    id: user2._id,
                    name: user2.name
                },
                status: 'accepted',
                createdAt: newConnection.createdAt
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Bulk add connections
exports.bulkAddConnections = async (req, res) => {
    try {
        const { connections } = req.body;
        
        if (!Array.isArray(connections) || connections.length === 0) {
            return res.status(400).json({ error: "Valid connections array is required" });
        }
        
        const results = {
            total: connections.length,
            successful: 0,
            failed: 0,
            errors: []
        };
        
        // Process each connection
        for (const conn of connections) {
            try {
                const { userId1, userId2, notes } = conn;
                
                // Skip invalid pairs
                if (!userId1 || !userId2 || userId1 === userId2) {
                    results.failed++;
                    results.errors.push(`Invalid user pair: ${userId1}, ${userId2}`);
                    continue;
                }
                
                // Check if users exist
                const user1 = await User.findById(userId1);
                const user2 = await User.findById(userId2);
                
                if (!user1 || !user2) {
                    results.failed++;
                    results.errors.push(`One or both users not found: ${userId1}, ${userId2}`);
                    continue;
                }
                
                // Check if connection already exists
                const existingConnection = await Connection.findOne({
                    $or: [
                        { requester: userId1, recipient: userId2 },
                        { requester: userId2, recipient: userId1 }
                    ]
                });
                
                if (existingConnection) {
                    results.failed++;
                    results.errors.push(`Connection already exists: ${userId1}, ${userId2}`);
                    continue;
                }
                
                // Create new connection
                const newConnection = new Connection({
                    requester: userId1,
                    recipient: userId2,
                    status: 'accepted',
                    notes: notes || '',
                    lastActivity: new Date()
                });
                
                await newConnection.save();
                results.successful++;
            } catch (error) {
                results.failed++;
                results.errors.push(error.message);
            }
        }
        
        res.status(201).json({ 
            message: "Bulk connection creation complete",
            results
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Find potential connections
exports.findPotentialConnections = async (req, res) => {
    try {
        // Get user's current connections
        const currentConnections = await Connection.find({
            $or: [
                { requester: req.user.id, status: 'accepted' },
                { recipient: req.user.id, status: 'accepted' }
            ]
        });
        
        // Get IDs of all users already connected
        const connectedUserIds = currentConnections.map(conn => {
            return conn.requester.toString() === req.user.id ? 
                conn.recipient.toString() : conn.requester.toString();
        });
        
        // Add current user ID to exclusion list
        connectedUserIds.push(req.user.id);
        
        // Get current user for industry and chapter matching
        const currentUser = await User.findById(req.user.id);
        
        // Find potential connections based on industry or chapter match
        const potentialConnections = await User.find({
            _id: { $nin: connectedUserIds },
            $or: [
                { industry: currentUser.industry },
                { chapter: currentUser.chapter }
            ]
        }).limit(10).select('name title company industry chapter');
        
        res.json({
            potentialConnections: potentialConnections.map(user => ({
                id: user._id,
                name: user.name,
                title: user.title,
                company: user.company,
                industry: user.industry,
                matchReason: user.industry === currentUser.industry ? 
                    'Same industry' : 'Same chapter'
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Enhanced search across all network connections
exports.searchNetwork = async (req, res) => {
    try {
        const { 
            query = '', 
            type = 'all', 
            industry,
            company,
            sortBy = 'name', 
            page = 1, 
            limit = 20 
        } = req.query;

        let results = [];
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Search based on the type parameter
        switch(type) {
            case 'connections':
                // Search within user's connections
                results = await searchMyConnections(req.user.id, query, industry, company);
                break;
                
            case 'pending':
                // Search within pending requests
                results = await searchPendingRequests(req.user.id, query, industry, company);
                break;
                
            case 'chapter':
                // Search within chapter members
                results = await searchChapterMembers(req.user.id, query, industry, company);
                break;
                
            case 'all':
            default:
                // Search across all network categories
                const connections = await searchMyConnections(req.user.id, query, industry, company);
                const pending = await searchPendingRequests(req.user.id, query, industry, company);
                const chapter = await searchChapterMembers(req.user.id, query, industry, company);
                
                // Combine and mark the type
                connections.forEach(item => item.connectionType = 'connection');
                pending.forEach(item => item.connectionType = 'pending');
                chapter.forEach(item => item.connectionType = 'chapter');
                
                results = [...connections, ...pending, ...chapter];
        }
        
        // Apply sorting
        results = sortResults(results, sortBy);
        
        // Get total count for pagination
        const totalResults = results.length;
        
        // Apply pagination
        results = results.slice(skip, skip + parseInt(limit));
        
        res.json({
            results,
            pagination: {
                total: totalResults,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalResults / parseInt(limit))
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Helper function to search connections
async function searchMyConnections(userId, query, industry, company) {
    const connections = await Connection.find({
        $or: [
            { requester: userId, status: 'accepted' },
            { recipient: userId, status: 'accepted' }
        ]
    }).populate({
        path: 'requester recipient',
        select: 'name title company industry lastActive chapter'
    });

    return connections
        .map(connection => {
            const connectionUser = connection.requester._id.toString() === userId ? 
                connection.recipient : connection.requester;
            
            return {
                id: connectionUser._id,
                connectionId: connection._id, 
                name: connectionUser.name,
                title: connectionUser.title,
                company: connectionUser.company,
                industry: connectionUser.industry,
                lastActive: connectionUser.lastActive,
                mutualConnections: 0, // This would need to be calculated
                connectionDate: connection.updatedAt
            };
        })
        .filter(user => {
            const searchableString = `${user.name} ${user.title} ${user.company} ${user.industry}`.toLowerCase();
            let matches = true;
            
            // Apply text search filter
            if (query) {
                matches = matches && searchableString.includes(query.toLowerCase());
            }
            
            // Apply industry filter
            if (industry) {
                matches = matches && user.industry === industry;
            }
            
            // Apply company filter
            if (company) {
                matches = matches && user.company.toLowerCase().includes(company.toLowerCase());
            }
            
            return matches;
        });
}

// Helper function to search pending requests
async function searchPendingRequests(userId, query, industry, company) {
    const pendingRequests = await Connection.find({
        recipient: userId,
        status: 'pending'
    }).populate({
        path: 'requester',
        select: 'name title company industry lastActive chapter'
    });

    return pendingRequests
        .map(request => ({
            id: request._id,
            userId: request.requester._id,
            name: request.requester.name,
            title: request.requester.title,
            company: request.requester.company,
            industry: request.requester.industry,
            lastActive: request.requester.lastActive,
            requestDate: request.createdAt,
            mutualConnections: 0 // Would need to be calculated
        }))
        .filter(user => {
            const searchableString = `${user.name} ${user.title} ${user.company} ${user.industry}`.toLowerCase();
            let matches = true;
            
            // Apply text search filter
            if (query) {
                matches = matches && searchableString.includes(query.toLowerCase());
            }
            
            // Apply industry filter
            if (industry) {
                matches = matches && user.industry === industry;
            }
            
            // Apply company filter
            if (company) {
                matches = matches && user.company.toLowerCase().includes(company.toLowerCase());
            }
            
            return matches;
        });
}

// Helper function to search chapter members
async function searchChapterMembers(userId, query, industry, company) {
    // Get user's chapter
    const user = await User.findById(userId);
    if (!user || !user.chapter) {
        return [];
    }

    const chapter = await Chapter.findById(user.chapter).populate({
        path: 'members',
        select: 'name title company industry lastActive'
    });

    if (!chapter) {
        return [];
    }

    return chapter.members
        .filter(member => member._id.toString() !== userId) // Exclude current user
        .map(member => ({
            id: member._id,
            name: member.name,
            title: member.title,
            company: member.company,
            industry: member.industry,
            lastActive: member.lastActive,
            chapterName: chapter.name,
            location: chapter.location
        }))
        .filter(user => {
            const searchableString = `${user.name} ${user.title} ${user.company} ${user.industry}`.toLowerCase();
            let matches = true;
            
            // Apply text search filter
            if (query) {
                matches = matches && searchableString.includes(query.toLowerCase());
            }
            
            // Apply industry filter
            if (industry) {
                matches = matches && user.industry === industry;
            }
            
            // Apply company filter
            if (company) {
                matches = matches && user.company.toLowerCase().includes(company.toLowerCase());
            }
            
            return matches;
        });
}

// Helper function to sort results
function sortResults(results, sortBy) {
    switch(sortBy) {
        case 'recent':
            return results.sort((a, b) => {
                const dateA = a.connectionDate || a.requestDate || a.lastActive || new Date(0);
                const dateB = b.connectionDate || b.requestDate || b.lastActive || new Date(0);
                return dateB - dateA;
            });
        case 'company':
            return results.sort((a, b) => a.company.localeCompare(b.company));
        case 'industry':
            return results.sort((a, b) => a.industry.localeCompare(b.industry));
        case 'name':
        default:
            return results.sort((a, b) => a.name.localeCompare(b.name));
    }
}