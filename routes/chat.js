const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const chatController = require('../controllers/chatController');

/**
 * GET /api/chat/history/:otherUserId
 */
router.get('/history/:otherUserId', async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const currentUserId = req.query.userId;

        if (!currentUserId) return res.status(400).json({ message: "User ID required." });

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
        console.error("❌ History Error:", error);
        res.status(500).json({ message: "Server error retrieving chat history." });
    }
});

/**
 * POST /api/chat/summarize
 */
router.post('/summarize', async (req, res) => {
    try {
        const { messages } = req.body;
        if (!messages || messages.length === 0)
            return res.status(400).json({ message: "No messages to summarize." });

        const conversation = messages
            .filter(m => m.type === 'text')
            .map(m => `${m.senderName || 'User'}: ${m.content}`)
            .join('\n');

        if (!conversation.trim())
            return res.status(400).json({ message: "No text messages found." });

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: `You are a conversation summarizer. Summarize into exactly 4-6 clear bullet points. Each point one sentence max. Focus on: key topics, decisions, important info. Return ONLY a JSON array of strings, no markdown, no extra text. Example: ["Point one", "Point two"]`
                    },
                    { role: 'user', content: `Summarize this:\n\n${conversation}` }
                ],
                max_tokens: 500,
                temperature: 0.3
            })
        });

        const groqData = await groqResponse.json();
        if (!groqResponse.ok) return res.status(500).json({ message: "AI summarization failed." });

        const rawText = groqData.choices[0].message.content.trim();
        let points = [];
        try { points = JSON.parse(rawText); }
        catch { points = rawText.split('\n').filter(p => p.trim()); }

        res.json({ points });
    } catch (error) {
        console.error("❌ Summarize Error:", error);
        res.status(500).json({ message: "Server error during summarization." });
    }
});

/**
 * POST /api/chat/polish
 * Takes a rough typed message and returns a polished clean version.
 */
router.post('/polish', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim())
            return res.status(400).json({ message: "No text to polish." });

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: `You are a message polisher for a chat app.
The user typed a rough or messy message. Rewrite it clearly and naturally.
Fix grammar, spelling, punctuation and structure.
Keep the same meaning and tone — casual stays casual, formal stays formal.
Keep it concise. Do NOT add extra words, explanations or commentary.
Return ONLY the polished message. No quotes, no labels, nothing else.`
                    },
                    { role: 'user', content: text }
                ],
                max_tokens: 300,
                temperature: 0.4
            })
        });

        const groqData = await groqResponse.json();
        if (!groqResponse.ok) return res.status(500).json({ message: "Polish failed." });

        const polished = groqData.choices[0].message.content.trim();
        res.json({ polished });

    } catch (error) {
        console.error("❌ Polish Error:", error);
        res.status(500).json({ message: "Server error during polishing." });
    }
});


/**
 * POST /api/chat/translate
 * Translates a given text into the specified target language using Groq.
 */
router.post('/translate', async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;
        
        if (!text || !text.trim() || !targetLanguage) {
            return res.status(400).json({ message: "Text and target language are required." });
        }

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}` 
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant', // Using the fast, free tier model
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional, highly accurate translation engine for a secure messaging app. 
Translate the user's message into ${targetLanguage}. 
Maintain the original tone, urgency, and formatting. 
Return ONLY the translated text. Do NOT wrap it in quotes, and do NOT add any conversational filler or explanations.`
                    },
                    { role: 'user', content: text }
                ],
                max_tokens: 500,
                temperature: 0.3 // Low temperature for more deterministic/accurate translation
            })
        });

        const groqData = await groqResponse.json();
        
        if (!groqResponse.ok) {
            console.error("Groq API Error:", groqData);
            return res.status(500).json({ message: "Translation API failed." });
        }

        const translated = groqData.choices[0].message.content.trim();
        res.json({ translated });

    } catch (error) {
        console.error("❌ Translate Error:", error);
        res.status(500).json({ message: "Server error during translation." });
    }
});

module.exports = router;