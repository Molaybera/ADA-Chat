const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// http://localhost:3000/api/auth/register
router.post('/register', authController.register);

// http://localhost:3000/api/auth/login
router.post('/login', authController.login);

// http://localhost:3000/api/auth/verify-otp
router.post('/verify-otp', authController.verifyOTP);

module.exports = router;