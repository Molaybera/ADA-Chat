const User = require('../models/User');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

/**
 * AUTH CONTROLLER - Production Email Logic via Nodemailer (Gmail)
 * FILEPATH: controllers/authController.js
 * Transition: Migrated from Brevo to Nodemailer using Google App Password.
 * Theme: Cyberpunk/Terminal aesthetic (Neon Green on Dark).
 */

// ✅ Initialize Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // This should be your 16-character Google App Password
    }
});

// Verify connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.log("🚨 [NODEMAILER ERROR]: Transporter config failed:", error);
    } else {
        console.log("✅ [NODEMAILER]: Server is ready to send emails");
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
        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        console.log(`[NODEMAILER] Delivering OTP to: ${email}`);

        const mailOptions = {
            from: `"ADA Secure" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "NODE_AWAITING_TOKEN: Identity Verification",
            html: `
                <div style="font-family: 'Courier New', Courier, monospace; max-width: 500px; margin: 0 auto; background-color: #050505; color: #00ff41; border-top: 4px solid #00ff41; padding: 40px; text-align: left; border-radius: 4px;">
                    <div style="margin-bottom: 20px; display: flex; align-items: center;">
                        <span style="background-color: #00ff41; color: #000; padding: 2px 8px; font-size: 10px; font-weight: bold; margin-right: 10px;">NODE_AWAITING_TOKEN</span>
                    </div>
                    
                    <div style="font-size: 40px; margin-bottom: 10px;">🔑</div>
                    
                    <h1 style="font-size: 24px; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #ffffff;">IDENTITY_VERIFICATION</h1>
                    <p style="color: #00ff41; font-size: 13px; margin-top: 5px; opacity: 0.8;">> 6-digit access token transmitted to registered comms channel...</p>
                    
                    <div style="margin-top: 40px; border-left: 2px solid #00ff41; padding-left: 20px;">
                        <p style="font-size: 11px; color: #ffffff; letter-spacing: 1px; margin-bottom: 10px; opacity: 0.7;">TOKEN_EXPIRATION_IN: 10_MINUTES</p>
                        <div style="font-size: 48px; font-weight: bold; letter-spacing: 10px; color: #00ff41;">${otp}</div>
                    </div>

                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(0, 255, 65, 0.2); font-size: 10px; color: #888;">
                        <p>> System: ADA_CHAT_SECURE_NETWORK</p>
                        <p>> Protocol: SECURE_LOGIN_v2.5</p>
                        <p style="margin-top: 10px;">&copy; 2026 TERM_STATION_ALPHA</p>
                    </div>
                </div>`
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log('✅ [NODEMAILER] Email sent successfully to:', email);
            res.status(200).json({ message: "OTP sent to your email." });
        } catch (sendError) {
            console.error("🚨 [NODEMAILER SEND ERROR]:", sendError.message);
            res.status(500).json({ message: "Email delivery failed." });
        }

    } catch (error) {
        console.error("Login processing failed:", error);
        res.status(500).json({ message: "Internal login failure." });
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

        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET || 'secret', 
            { expiresIn: '24d' }
        );
        
        res.status(200).json({ token, user: { id: user._id, name: user.name } });
    } catch (error) {
        res.status(500).json({ message: "Verification failed." });
    }
};