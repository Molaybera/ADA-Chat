/**
 * Chat Controller - Server-Side Encryption & WebRTC Signaling
 * Handles real-time messaging and peer-to-peer call handshakes.
 * FILEPATH: controllers/chatController.js
 */
const Message = require('../models/Message');
const crypto = require('crypto');

// --- ENCRYPTION CONFIGURATION ---
const algorithm = 'aes-256-cbc';
// Derive a 32-byte key from the environment's JWT_SECRET
const encryptionKey = crypto.scryptSync(process.env.JWT_SECRET || 'secure_fallback_key', 'salt', 32);
const iv = Buffer.alloc(16, 0); // Fixed IV ensures consistent decryption for history

/**
 * Server-Side Encryption Helper
 * Scrambles plain text into hex for MongoDB storage.
 */
function encrypt(text) {
    if (!text || typeof text !== 'string') return text;
    try {
        const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    } catch (err) {
        console.error("❌ Encryption Error:", err);
        return text;
    }
}

/**
 * Server-Side Decryption Helper
 * Converts hex back to plain text for the UI.
 */
function decrypt(text) {
    if (!text || typeof text !== 'string') return text;
    try {
        const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
        let decrypted = decipher.update(text, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        // Fallback for messages saved as plain text before encryption was active
        return text; 
    }
}

const onlineUsers = new Map();

module.exports = (io) => {
    io.on('connection', (socket) => {
        
        // --- USER REGISTRATION ---
        socket.on('registerUser', (data) => {
            const { userId, userName } = data;
            if (!userId) return;
            onlineUsers.set(userId, { socketId: socket.id, userName, userId });
            io.emit('updateUserList', Array.from(onlineUsers.values()));
        });

        // --- PRIVATE MESSAGING (WITH ENCRYPTION) ---
        socket.on('privateMessage', async (msgData) => {
            try {
                const { receiverId, senderId, content, type, fileName } = msgData;

                // 1. Encrypt only for database storage
                const encryptedContent = encrypt(content);

                const savedMsg = await Message.create({
                    senderId,
                    receiverId,
                    content: encryptedContent,
                    type,
                    fileName
                });

                // 2. Route the PLAIN text to the recipient for instant display
                const recipient = onlineUsers.get(receiverId);
                if (recipient) {
                    io.to(recipient.socketId).emit('receivePrivateMessage', {
                        ...msgData,
                        content: content, // Receiver gets readable text
                        _id: savedMsg._id,
                        timestamp: savedMsg.timestamp
                    });
                }
            } catch (err) {
                console.error("❌ Message processing error:", err);
            }
        });

        // --- WebRTC SIGNALING (VOICE & VIDEO CALLS) ---
        
        /**
         * call-user: Initiates a call request
         * data: { to, from, fromName, offer, type }
         */
        socket.on('call-user', (data) => {
            const recipient = onlineUsers.get(data.to);
            if (recipient) {
                io.to(recipient.socketId).emit('incoming-call', {
                    from: data.from,
                    fromName: data.fromName,
                    offer: data.offer,
                    type: data.type // 'voice' or 'video'
                });
            }
        });

        /**
         * answer-call: Responds to an incoming call
         * data: { to, answer }
         */
        socket.on('answer-call', (data) => {
            const caller = onlineUsers.get(data.to);
            if (caller) {
                io.to(caller.socketId).emit('call-answered', {
                    answer: data.answer
                });
            }
        });

        /**
         * ice-candidate: Exchanges network path information
         * data: { to, candidate }
         */
        socket.on('ice-candidate', (data) => {
            const recipient = onlineUsers.get(data.to);
            if (recipient) {
                io.to(recipient.socketId).emit('ice-candidate', {
                    candidate: data.candidate
                });
            }
        });

        /**
         * hang-up: Notifies the other party to terminate the stream
         * data: { to }
         */
        socket.on('hang-up', (data) => {
            const otherUser = onlineUsers.get(data.to);
            if (otherUser) {
                io.to(otherUser.socketId).emit('call-ended');
            }
        });

        // --- DISCONNECTION ---
        socket.on('disconnect', () => {
            for (const [uid, user] of onlineUsers.entries()) {
                if (user.socketId === socket.id) {
                    onlineUsers.delete(uid);
                    break;
                }
            }
            io.emit('updateUserList', Array.from(onlineUsers.values()));
        });
    });
};

// Export helpers for use in routes/chat.js (History Decryption)
module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;