const User = require('../models/User'); 
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// 1. HIGH-COMPATIBILITY TRANSPORTER CONFIG
// Using pooling and extra-long timeouts to survive cloud network filters
const transporter = nodemailer.createTransport({
    pool: true, // Use a pool of connections instead of creating new ones for every mail
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    // Increased timeouts to 30 seconds for slow cloud handshakes
    connectionTimeout: 30000, 
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: {
        // Essential for cloud providers to prevent SSL handshake drops
        rejectUnauthorized: false,
        minVersion: "TLSv1.2"
    }
});

// Startup check - this will show in your Render logs immediately
transporter.verify((error) => {
    if (error) {
        console.error("❌ Nodemailer Setup Error:", error.message);
        console.log("💡 Tip: If you see 'ETIMEDOUT', Render is blocking Gmail's ports. We may need to use an API-based service like SendGrid or Resend.");
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
        console.log(`[AUTH] Login attempt for: ${email}`); 

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
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 20px; overflow: hidden;">
                    <div style="padding: 30px; text-align: center; background: #7c3aed; color: white;">
                        <h2>Security Code</h2>
                    </div>
                    <div style="padding: 30px; text-align: center;">
                        <p>Use the code below to log in:</p>
                        <h1 style="font-size: 40px; letter-spacing: 5px; color: #00d4ff;">${otp}</h1>
                        <p style="font-size: 12px; color: #94a3b8;">This code expires in 10 minutes.</p>
                    </div>
                </div>
            `
        };

        console.log("[MAIL] Attempting to send via Port 587...");
        await transporter.sendMail(mailOptions);
        console.log("✅ [MAIL] OTP sent successfully");
        
        res.status(200).json({ message: "OTP sent to your email." });

    } catch (error) {
        console.error("🚨 [MAIL ERROR]:", error.message);
        res.status(500).json({ message: "Email delivery failed. The hosting provider may be blocking the connection." });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });
        
        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }
        
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