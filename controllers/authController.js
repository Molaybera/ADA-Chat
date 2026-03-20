const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { BrevoClient } = require('@getbrevo/brevo');

/**
 * AUTH CONTROLLER - Production Email Logic via Brevo API
 * FILEPATH: controllers/authController.js
 * Fix: Uses brevo.transactionalEmails.sendTransacEmail() — confirmed correct method.
 */

// ✅ Correct initialization
const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

console.log("BREVO_API_KEY:", process.env.BREVO_API_KEY ? "SET" : "NOT SET");

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

        console.log(`[BREVO] Delivering OTP to: ${email}`);

        try {
            // ✅ Correct: brevo.transactionalEmails.sendTransacEmail()
            await brevo.transactionalEmails.sendTransacEmail({
                sender: { name: "ADA Chat Support", email: process.env.EMAIL_USER },
                to: [{ email: email }],
                subject: "🔒 Your Verification Code",
                htmlContent: `
                    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 24px; padding: 40px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
                        <div style="margin-bottom: 20px; font-size: 40px;">🛡️</div>
                        <h2 style="color: #00d4ff; margin-bottom: 10px;">Security Code</h2>
                        <p style="color: #94a3b8; font-size: 14px;">Use the following code to access your account. It expires in 10 minutes.</p>
                        <div style="background: rgba(255,255,255,0.05); border: 1px dashed #00d4ff; border-radius: 12px; padding: 20px; margin: 25px 0;">
                            <span style="font-size: 42px; font-weight: 800; letter-spacing: 8px; color: #00d4ff;">${otp}</span>
                        </div>
                        <p style="font-size: 11px; color: #475569;">&copy; 2026 ADA Chat Secure Network</p>
                    </div>`
            });
            console.log('✅ [BREVO] Email sent successfully to:', email);
            res.status(200).json({ message: "OTP sent to your email." });
        } catch (apiError) {
            console.error("🚨 [BREVO ERROR]:", apiError?.response?.body || apiError?.message || apiError);
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
        if (user.otp !== otp || user.otpExpires < Date.now()) return res.status(400).json({ message: "Invalid or expired OTP" });

        user.otp = null;
        user.otpExpires = null;
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
        res.status(200).json({ token, user: { id: user._id, name: user.name } });
    } catch (error) {
        res.status(500).json({ message: "Verification failed." });
    }
};