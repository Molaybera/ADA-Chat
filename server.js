require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

// Import modular components
const authRoutes = require('./routes/auth');
const viewRoutes = require('./routes/view');
const chatHandler = require('./controllers/chatController');
const chatRoutes = require('./routes/chat');


const app = express();
const server = http.createServer(app);

// Initialize Socket.io with the HTTP server
const io = new Server(server, {
    cors: {
        origin: "*", // Allows connections from Render/Railway URL
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Attach modular routes
app.use('/api/auth', authRoutes);
app.use('/', viewRoutes);

app.use('/api/chat', chatRoutes);

// --- MODULAR SOCKET LOGIC ---
// This connects the backend "brain" that manages online users and private routing.
chatHandler(io);

/**
 * Database Connection & Maintenance
 * Includes an auto-fix for the legacy index error.
 */
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB Atlas');
        console.log('🕐 Message auto-delete active — messages expire after 24 hours');
    })
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Global Error Handler for uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('🔥 Critical Error:', err);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Secure Messenger running at http://localhost:${PORT}`);
    console.log(`🛡️  Privacy Mode: Session-based storage active`);
});