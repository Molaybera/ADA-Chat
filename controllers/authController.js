const User = require('../models/User'); 
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// 1. RESILIENT TRANSPORTER CONFIG FOR PRODUCTION (Using Port 587 for better compatibility)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Port 587 uses STARTTLS (secure: false), not SSL (secure: true)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    // Adding a timeout and retries to handle cloud latency
    connectionTimeout: 15000, 
    greetingTimeout: 15000,
    socketTimeout: 15000,
    tls: {
        // This ensures the connection doesn't fail due to self-signed certificate issues in some environments
        rejectUnauthorized: false
    }
});

// Verify connection configuration on startup
transporter.verify(function (error, success) {
    if (error) {
        console.error("❌ Nodemailer Setup Error:", error.message);
    } else {
        console.log("✅ Email Server is ready to send OTPs");
    }
});

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
        console.error("Registration Error:", error);
        res.status(500).json({ message: "Server error during registration." });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`Attempting login for: ${email}`); 

        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; 
        await user.save();

        const mailOptions = {
            from: `"ADA Chat Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔒 Your Verification Code',
            html: `
                <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 24px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #00d4ff, #7c3aed);">
                        <div style="font-size: 48px; margin-bottom: 10px;">🛡️</div>
                        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Security Verification</h1>
                    </div>
                    <div style="padding: 40px 30px;">
                        <p style="font-size: 16px; line-height: 1.6; color: #94a3b8; margin-bottom: 30px;">
                            Hello,<br><br>
                            To complete your sign-in to <strong>ADA Chat</strong>, please use the following one-time verification code. This code is valid for <strong>10 minutes</strong>.
                        </p>
                        <div style="background: rgba(255,255,255,0.05); border: 1px dashed #00d4ff; border-radius: 16px; padding: 25px; text-align: center; margin-bottom: 30px;">
                            <span style="font-family: monospace; font-size: 42px; font-weight: 800; color: #00d4ff; letter-spacing: 8px;">${otp}</span>
                        </div>
                    </div>
                </div>
            `
        };

        console.log("Sending email via Port 587...");
        await transporter.sendMail(mailOptions);
        console.log("✅ OTP Email sent successfully to:", email);
        
        res.status(200).json({ message: "OTP sent to your email." });

    } catch (error) {
        console.error("🚨 LOGIN/OTP FATAL ERROR:", {
            message: error.message,
            code: error.code,
            command: error.command
        });
        res.status(500).json({ message: "Failed to process login. Please check server logs." });
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
        console.error("OTP Verification Error:", error);
        res.status(500).json({ message: "Verification failed." });
    }
};