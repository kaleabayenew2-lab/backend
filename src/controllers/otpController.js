// OTP controller for backend API
const { connectToDatabase, initializeDatabase } = require('../database/connection');
const { initializeEmailService, sendOTPEmail } = require('../services/emailService');

// Store OTPs in memory (in production, use Redis or database)
const otpStore = new Map();

// Generate 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP via email
async function sendOtpEmail(email, otp) {
  try {
    // Use existing email service
    const subject = 'FindMe - Verify Your Email';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🔐 Email Verification</h1>
          <p style="margin: 10px 0; font-size: 16px;">Welcome to FindMe!</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 15px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Your Verification Code</h2>
          <div style="background: #fff; border: 2px dashed #ddd; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; text-align: center; display: block;">
              ${otp}
            </span>
          </div>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-weight: bold;">⏰ This code expires in 10 minutes</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
            <p style="color: #666; font-size: 14px;">For support, contact us at support@findme.com</p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 15px;">
          <p style="margin: 0; color: #666; font-size: 12px;">© 2024 FindMe. All rights reserved.</p>
        </div>
      </div>
    `;

    await initializeEmailService();
    const result = await sendOTPEmail(email, subject, html);
    return result.success;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

// Send OTP
async function sendOTP(req, res) {
  try {
    const { identifier, method, facilityName } = req.body;

    if (!identifier || !method) {
      return res.status(400).json({ message: 'Identifier and method are required' });
    }

    // Connect to database
    const db = connectToDatabase();
    initializeDatabase();

    // Check if user has exceeded attempt limit in the last 15 minutes
    const attemptCount = db.prepare(
      'SELECT SUM(attempts) as total_attempts FROM otp_codes WHERE identifier = ? AND method = ? AND created_at > datetime(\'now\', \'-15 minutes\')'
    ).get([identifier, method]);

    if (attemptCount && attemptCount.total_attempts >= 3) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP attempts. Please try again after 15 minutes.',
        locked: true
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store OTP in database
    db.prepare('INSERT INTO otp_codes (identifier, method, code, expires_at) VALUES (?, ?, ?, ?)').run([identifier, method, otp, expiresAt.toISOString()]);

    // Log OTP for debugging
    console.log(`OTP for ${method} ${identifier}: ${otp} (expires: ${expiresAt})`);

    // VERY PROMINENT OTP DISPLAY
    console.log('\n\n⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️');
    console.log('⚠️                                                ⚠️');
    console.log('⚠️               SEND OTP ONLY                      ⚠️');
    console.log('⚠️                                                ⚠️');
    console.log('⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️');
    console.log(`⚠️  EMAIL: ${identifier}                              ⚠️`);
    console.log(`⚠️  OTP CODE: ${otp}                                ⚠️`);
    console.log(`⚠️  FACILITY: ${facilityName || 'Facility'}           ⚠️`);
    console.log('⚠️                                                ⚠️');
    console.log('⚠️  USE THIS CODE TO VERIFY EMAIL                    ⚠️');
    console.log('⚠️                                                ⚠️');
    console.log('⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️\n\n');

    // Send OTP via email service
    let emailResult = { success: false };
    if (method === 'email') {
      emailResult = await sendOTPEmail(identifier, otp, facilityName || 'Facility');
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      expiresIn: 600, // 10 minutes in seconds
      developmentOTP: process.env.NODE_ENV === 'development' ? otp : undefined, // Only in development
      emailSent: emailResult.success,
      emailMethod: emailResult.method || 'failed'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Error sending OTP' });
  }
}

// Verify OTP
async function verifyOTP(req, res) {
  try {
    const { identifier, code, method } = req.body;

    if (!identifier || !code || !method) {
      return res.status(400).json({ message: 'Identifier, code, and method are required' });
    }

    // Connect to database
    const db = connectToDatabase();
    initializeDatabase();

    // Find valid OTP
    const otpRecord = db.prepare(
      `SELECT * FROM otp_codes 
       WHERE identifier = ? AND method = ? AND code = ? 
       AND expires_at > datetime('now') AND is_used = 0`
    ).get([identifier, method, code]);

    if (!otpRecord) {
      // Increment attempts for failed verification
      db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE identifier = ? AND method = ?').run([identifier, method]);

      // Check if too many attempts
      const attemptCount = db.prepare(
        'SELECT SUM(attempts) as total_attempts FROM otp_codes WHERE identifier = ? AND method = ? AND created_at > datetime(\'now\', \'-15 minutes\')'
      ).get([identifier, method]);

      if (attemptCount && attemptCount.total_attempts >= 3) {
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Please try again after 15 minutes.',
          locked: true
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as used
    db.prepare('UPDATE otp_codes SET is_used = 1 WHERE id = ?').run([otpRecord.id]);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Error verifying OTP' });
  }
}

// Send OTP for registration
exports.sendRegistrationOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP
    otpStore.set(email, {
      otp,
      expiresAt,
      purpose: 'registration',
      attempts: 0,
    });

    // Send email
    const emailSent = await sendOtpEmail(email, otp);

    if (emailSent) {
      res.json({ 
        success: true, 
        message: 'OTP sent successfully',
        expiresIn: '10 minutes'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send OTP email' 
      });
    }
  } catch (error) {
    console.error('Send registration OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Verify OTP for registration
exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const { email, otp, fullName, age, phone, password } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const storedData = otpStore.get(email);

    if (!storedData) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP not found or expired' 
      });
    }

    // Check expiration
    if (new Date() > storedData.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }

    // Check attempts
    if (storedData.attempts >= 3) {
      otpStore.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'Too many attempts. Please request a new OTP.' 
      });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      otpStore.set(email, {
        ...storedData,
        attempts: storedData.attempts + 1,
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    // OTP is valid - remove it from store and create user
    otpStore.delete(email);

    // Import User model to create the user
    const User = require('../models/user');

    try {
      const newUser = await User.create({
        fullName,
        age: parseInt(age),
        email,
        password,
        phone,
      });

      res.json({ 
        success: true, 
        message: 'Registration successful!',
        user: {
          id: newUser.id,
          fullName: newUser.fullName,
          email: newUser.email,
        }
      });
    } catch (userError) {
      console.error('User creation error:', userError);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create user account' 
      });
    }

  } catch (error) {
    console.error('Verify registration OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  sendRegistrationOtp,
  verifyRegistrationOtp
};
