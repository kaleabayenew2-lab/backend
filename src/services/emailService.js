// Email service for sending OTP emails
const nodemailer = require('nodemailer');
let transporter = null;

// Initialize email transporter
const initializeEmailService = async () => {
  try {
    // Create transporter using Gmail SMTP
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com', // Replace with your Gmail
        pass: process.env.EMAIL_PASS || 'your-app-password', // Replace with your Gmail app password
      },
    });

    // Verify connection
    await transporter.verify();
    console.log('📧 Email service initialized with Gmail SMTP');
    console.log('📧 Email user:', process.env.EMAIL_USER || 'your-email@gmail.com');
    return true;
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    console.log('📧 Falling back to console logging mode');
    transporter = null;
    return false;
  }
};

// Send OTP email
const sendOTPEmail = async (email, otp, facilityName) => {
  try {
    // Always show the OTP in terminal for debugging
    console.log('\n');
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log('🔥                                                    🔥');
    console.log('🔥               SEND OTP ONLY                      🔥');
    console.log('🔥                                                    🔥');
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log('🔥                                                    🔥');
    console.log(`🔥  EMAIL: ${email}                                🔥`);
    console.log(`🔥  FACILITY: ${facilityName}                        🔥`);
    console.log(`🔥  OTP CODE: ${otp}                                 🔥`);
    console.log('🔥                                                    🔥');
    console.log('🔥  USE THIS CODE TO VERIFY THE EMAIL               🔥');
    console.log('🔥  CODE EXPIRES IN 10 MINUTES                      🔥');
    console.log('🔥                                                    🔥');
    console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥');
    console.log('\n');
    
    // Try to send real email if transporter is available
    if (transporter) {
      const mailOptions = {
        from: `"Find Med" <${process.env.EMAIL_USER || 'your-email@gmail.com'}>`,
        to: email,
        subject: 'Verify Your Email Address - Facility Registration',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6;">
              <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Email Verification</h2>
              <p style="color: #666; font-size: 16px; margin-bottom: 15px;">
                Thank you for registering <strong>${facilityName}</strong> in our Find Med system.
              </p>
              <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                Please use the following verification code to complete your registration:
              </p>
              <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="margin: 0; font-size: 32px; letter-spacing: 4px; font-weight: bold;">${otp}</h1>
              </div>
              <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                This code will expire in <strong>10 minutes</strong>. If you didn't request this code, please ignore this email.
              </p>
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  This is an automated message from the Find Med system.
                </p>
              </div>
            </div>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('\x1b[32m%s\x1b[0m', `📧 EMAIL SENT SUCCESSFULLY TO: ${email}`);
      console.log('\x1b[32m%s\x1b[0m', `📧 Message ID: ${info.messageId}`);
      console.log('\x1b[32m%s\x1b[0m', '📧 Check your email inbox for the OTP code!\n');
      
      return { success: true, method: 'email', messageId: info.messageId };
    } else {
      // Fallback to console only
      console.log('\x1b[31m%s\x1b[0m', '📧 EMAIL SERVICE NOT CONFIGURED - Using console fallback');
      console.log('\x1b[31m%s\x1b[0m', '📧 To enable real email sending, configure EMAIL_USER and EMAIL_PASS environment variables');
      return { success: true, method: 'console' };
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    console.log('\x1b[31m%s\x1b[0m', '📧 EMAIL FAILED - Using console fallback');
    return { success: true, method: 'console', error: error.message };
  }
};

// Send password email
const sendPasswordEmail = async (email, password, facilityName) => {
  try {
    // Always show the password in terminal for debugging
    console.log('\n');
    console.log('🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑');
    console.log('🔑                                                    🔑');
    console.log('🔑               SEND PASSWORD EMAIL              🔑');
    console.log('🔑                                                    🔑');
    console.log('🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑');
    console.log('🔑                                                    🔑');
    console.log(`🔑  EMAIL: ${email}                                🔑`);
    console.log(`🔑  FACILITY: ${facilityName}                        🔑`);
    console.log(`🔑  PASSWORD: ${password}                             🔑`);
    console.log('🔑                                                    🔑');
    console.log('🔑  NEW PASSWORD GENERATED FOR FACILITY          🔑');
    console.log('🔑  PASSWORD EXPIRES IN 10 MINUTES               🔑');
    console.log('🔑                                                    🔑');
    console.log('🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑🔑');
    console.log('\n');
    
    // Try to send real email if transporter is available
    if (transporter) {
      const mailOptions = {
        from: `"Find Med" <${process.env.EMAIL_USER || 'your-email@gmail.com'}>`,
        to: email,
        subject: 'Your Facility Password Has Been Reset',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6;">
              <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Password Reset</h2>
              <p style="color: #666; font-size: 16px; margin-bottom: 15px;">
                Your password for <strong>${facilityName}</strong> in our Find Med system has been reset.
              </p>
              <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                Your new password is:
              </p>
              <div style="background-color: #28a745; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="margin: 0; font-size: 28px; letter-spacing: 3px; font-weight: bold;">${password}</h1>
              </div>
              <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                This password will expire in <strong>10 minutes</strong>. Please change it after logging in.
              </p>
              <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                If you didn't request this password reset, please contact support immediately.
              </p>
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  This is an automated message from the Find Med system.
                </p>
              </div>
            </div>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('\x1b[32m%s\x1b[0m', `📧 PASSWORD EMAIL SENT SUCCESSFULLY TO: ${email}`);
      console.log('\x1b[32m%s\x1b[0m', `📧 Message ID: ${info.messageId}`);
      console.log('\x1b[32m%s\x1b[0m', '📧 Check the email inbox for the new password!\n');
      
      return { success: true, method: 'email', messageId: info.messageId };
    } else {
      // Fallback to console only
      console.log('\x1b[31m%s\x1b[0m', '📧 EMAIL SERVICE NOT CONFIGURED - Using console fallback');
      console.log('\x1b[31m%s\x1b[0m', '📧 To enable real email sending, configure EMAIL_USER and EMAIL_PASS environment variables');
      return { success: true, method: 'console' };
    }
  } catch (error) {
    console.error('Failed to send password email:', error);
    console.log('\x1b[31m%s\x1b[0m', '📧 EMAIL FAILED - Using console fallback');
    return { success: true, method: 'console', error: error.message };
  }
};

module.exports = {
  initializeEmailService,
  sendOTPEmail,
  sendPasswordEmail,
};
