const User = require('../models/User'); 
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

// Initialize Resend with your API Key from Render Environment Variables
const resend = new Resend(process.env.RESEND_API_KEY);

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: "All fields are required." });
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: "User already exists." });
        const user = new User({ name, email, password });
        await user.save();
        res.status(201).json({ message: "Registration successful!" });
    } catch (error) {
        res.status(500).json({ message: "Server error during registration." });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; 
        await user.save();

        // Send OTP via Resend API (Bypasses Render's port blocks)
        const { data, error } = await resend.emails.send({
            from: 'Secure Chat <onboarding@resend.dev>',
            to: [email],
            subject: '🔒 Your Verification Code',
            html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 20px; padding: 40px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                    <h2 style="color: #00d4ff;">Security Verification</h2>
                    <p>Enter the code below to access your account:</p>
                    <h1 style="font-size: 48px; letter-spacing: 8px; margin: 20px 0;">${otp}</h1>
                    <p style="font-size: 12px; color: #94a3b8;">Code expires in 10 minutes.</p>
                </div>`
        });

        if (error) {
            console.error("Resend API Error:", error);
            return res.status(500).json({ message: "Failed to send OTP." });
        }

        res.status(200).json({ message: "OTP sent to your email." });
    } catch (error) {
        res.status(500).json({ message: "Login processing failed." });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.otp !== otp || user.otpExpires < Date.now()) return res.status(400).json({ message: "Invalid OTP" });
        
        user.otp = null;
        user.otpExpires = null;
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
        res.status(200).json({ token, user: { id: user._id, name: user.name } });
    } catch (error) {
        res.status(500).json({ message: "Verification failed." });
    }
};