const express = require('express');
const router = express.Router();
const path = require('path');

// Root redirects to login
router.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));

// Direct routes for each page
router.get('/register', (req, res) => res.sendFile(path.join(__dirname, '../public/register.html')));
router.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
router.get('/otp', (req, res) => res.sendFile(path.join(__dirname, '../public/otp.html')));
router.get('/chat', (req, res) => res.sendFile(path.join(__dirname, '../public/chat.html')));

module.exports = router;