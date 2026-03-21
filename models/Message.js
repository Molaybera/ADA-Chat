const mongoose = require('mongoose');

/**
 * Message Schema
 * Self-destructing messages — MongoDB TTL index auto-deletes after 24 hours.
 */
const messageSchema = new mongoose.Schema({
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content:    { type: String, required: true },
    type: {
        type: String,
        enum: ['text', 'image', 'file', 'call'],
        default: 'text'
    },
    fileName:  { type: String, default: null },
    timestamp: { type: Date, default: Date.now }
});

// Compound index for fast history queries
messageSchema.index({ senderId: 1, receiverId: 1, timestamp: 1 });

// ✅ TTL index — MongoDB automatically deletes messages after 24 hours
messageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('Message', messageSchema);