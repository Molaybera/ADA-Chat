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
        <div style="background-color: #050505; color: #00ff41; font-family: 'Courier New', Courier, monospace; max-width: 500px; margin: 0 auto; border: 2px solid #00ff41; padding: 40px; text-align: center;">
            <!-- Tactical Header -->
            <div style="border-bottom: 1px solid rgba(0, 255, 65, 0.3); padding-bottom: 20px; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 10px;">🛡️</div>
                <h1 style="font-size: 22px; letter-spacing: 5px; margin: 0; font-weight: bold; text-transform: uppercase;">Identity Enrollment</h1>
                <p style="font-size: 10px; color: rgba(0, 255, 65, 0.6); margin-top: 5px;">PROTOCOL: SECURE_AUTH_V4.0</p>
            </div>

            <!-- Message Body -->
            <p style="font-size: 13px; line-height: 1.6; color: #e0e0e0; text-align: left;">
                > INITIALIZING SECURE CHANNEL...<br>
                > REQUESTING ACCESS TOKEN FOR NODE: ${email}<br>
                > AUTHORIZATION REQUIRED TO ESTABLISH LINK.
            </p>

            <!-- OTP Display Box -->
            <div style="background: rgba(0, 255, 65, 0.05); border: 1px dashed #00ff41; padding: 30px; margin: 30px 0;">
                <p style="font-size: 11px; margin-bottom: 15px; color: rgba(0, 255, 65, 0.7); letter-spacing: 2px;">[ UNIQUE_ACCESS_KEY ]</p>
                <span style="font-size: 46px; font-weight: bold; letter-spacing: 12px; color: #00ff41; text-shadow: 0 0 10px rgba(0, 255, 65, 0.3);">${otp}</span>
            </div>

            <!-- Expiration Warning -->
            <div style="text-align: left; background: rgba(255, 49, 49, 0.1); border-left: 3px solid #ff3131; padding: 10px 15px; margin-bottom: 30px;">
                <p style="font-size: 11px; color: #ff3131; margin: 0;">
                    WARNING: Token validity expires in 600 seconds. Unauthorized use is prohibited.
                </p>
            </div>

            <!-- Tactical Footer -->
            <div style="border-top: 1px solid rgba(0, 255, 65, 0.3); padding-top: 20px; color: rgba(0, 255, 65, 0.4); font-size: 10px; letter-spacing: 1px;">
                © 2026 ADA_SECURE_NETWORK // NODE_ID: 0x7FF41<br>
                ENCRYPTION_LEVEL: AES-256-GCM
            </div>
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

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24d' });
        res.status(200).json({ token, user: { id: user._id, name: user.name } });
    } catch (error) {
        res.status(500).json({ message: "Verification failed." });
    }
};