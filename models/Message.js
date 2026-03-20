const mongoose = require('mongoose');

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

// Optimization for searching conversations
messageSchema.index({ senderId: 1, receiverId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);