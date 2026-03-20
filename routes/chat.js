const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const chatController = require('../controllers/chatController');

/**
 * GET /api/chat/history/:otherUserId
 * Fetches encrypted messages from DB and decrypts them before sending to user.
 */
router.get('/history/:otherUserId', async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const currentUserId = req.query.userId; 

        if (!currentUserId) {
            return res.status(400).json({ message: "User ID required to fetch history." });
        }

        const messages = await Message.find({
            $or: [
                { senderId: currentUserId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: currentUserId }
            ]
        }).sort({ timestamp: 1 });

        const decryptedMessages = messages.map(msg => {
            const doc = msg.toObject();
            doc.content = chatController.decrypt(doc.content);
            return doc;
        });

        res.json(decryptedMessages);
    } catch (error) {
        console.error("❌ Error fetching/decrypting history:", error);
        res.status(500).json({ message: "Server error retrieving chat history." });
    }
});

/**
 * POST /api/chat/summarize
 * Sends conversation messages to Groq (LLaMA) and returns an AI summary.
 */
router.post('/summarize', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || messages.length === 0) {
            return res.status(400).json({ message: "No messages to summarize." });
        }

        // Format messages into readable text for the AI
        const conversation = messages
            .filter(m => m.type === 'text')
            .map(m => `${m.senderName || 'User'}: ${m.content}`)
            .join('\n');

        if (!conversation.trim()) {
            return res.status(400).json({ message: "No text messages found to summarize." });
        }

        // Call Groq API
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: `You are a conversation summarizer. Summarize the chat conversation into exactly 4-6 clear bullet points. 
                        Each point should be concise (one sentence max). 
                        Focus on: key topics discussed, decisions made, important info shared.
                        Format: Return ONLY a JSON array of strings, no markdown, no extra text.
                        Example: ["Point one here", "Point two here", "Point three here"]`
                    },
                    {
                        role: 'user',
                        content: `Summarize this conversation:\n\n${conversation}`
                    }
                ],
                max_tokens: 500,
                temperature: 0.3
            })
        });

        const groqData = await groqResponse.json();

        if (!groqResponse.ok) {
            console.error("❌ Groq API Error:", groqData);
            return res.status(500).json({ message: "AI summarization failed." });
        }

        const rawText = groqData.choices[0].message.content.trim();

        // Parse the JSON array from the response
        let points = [];
        try {
            points = JSON.parse(rawText);
        } catch {
            // Fallback: split by newline if not valid JSON
            points = rawText.split('\n').filter(p => p.trim().length > 0);
        }

        res.json({ points });

    } catch (error) {
        console.error("❌ Summarize Error:", error);
        res.status(500).json({ message: "Server error during summarization." });
    }
});

module.exports = router;