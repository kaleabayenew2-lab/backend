// OTP controller for backend API
const { connectToDatabase, initializeDatabase } = require('../database/connection');
const { initializeEmailService, sendOTPEmail } = require('../services/emailService');

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

module.exports = {
  sendOTP,
  verifyOTP
};
