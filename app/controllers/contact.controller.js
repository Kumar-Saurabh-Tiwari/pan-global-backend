const Contact = require('../models/contact.model');

exports.contactUs = async (req, res) => {
    const { name, email, message } = req.body;
    try {
        const newMessage = new Contact({ name, email, message });
        await newMessage.save();
        res.status(201).json({ message: "Message sent successfully" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const messages = await Contact.find();
        res.json(messages);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};