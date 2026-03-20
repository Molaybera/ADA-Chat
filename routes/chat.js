const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const chatController = require('../controllers/chatController');

/**
 * GET /api/chat/history/:otherUserId
 * Fetches encrypted messages from DB and decrypts them before sending to user.
 * This fixes the issue where hex codes were appearing after a page refresh.
 */
router.get('/history/:otherUserId', async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const currentUserId = req.query.userId; 

        if (!currentUserId) {
            return res.status(400).json({ message: "User ID required to fetch history." });
        }

        // 1. Fetch messages from MongoDB (stored as encrypted hex strings)
        const messages = await Message.find({
            $or: [
                { senderId: currentUserId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: currentUserId }
            ]
        }).sort({ timestamp: 1 });

        // 2. DECRYPT messages on-the-fly
        // We use the decrypt function exported from the Chat Controller (Canvas)
        const decryptedMessages = messages.map(msg => {
            const doc = msg.toObject();
            // This turns the '5a3f...' hex back into readable text (e.g., 'Hello')
            doc.content = chatController.decrypt(doc.content);
            return doc;
        });

        res.json(decryptedMessages);
    } catch (error) {
        console.error("❌ Error fetching/decrypting history:", error);
        res.status(500).json({ message: "Server error retrieving chat history." });
    }
});

module.exports = router;