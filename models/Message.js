const mongoose = require('mongoose');

/**
 * Updated Message Schema
 * Includes 'call' in the enum to allow saving call duration logs.
 */
const messageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['text', 'image', 'file', 'call'], 
        default: 'text' 
    },
    fileName: { type: String, default: null },
    timestamp: { type: Date, default: Date.now }
});

messageSchema.index({ senderId: 1, receiverId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);