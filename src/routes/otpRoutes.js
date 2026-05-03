// OTP routes for backend API
const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, sendRegistrationOtp, verifyRegistrationOtp } = require('../controllers/otpController');

// POST /api/otp/send - Send OTP
router.post('/send', sendOTP);

// POST /api/otp/verify - Verify OTP
router.post('/verify', verifyOTP);

// POST /api/otp/send-registration - Send registration OTP
router.post('/send-registration', sendRegistrationOtp);

// POST /api/otp/verify-registration - Verify registration OTP
router.post('/verify-registration', verifyRegistrationOtp);

module.exports = router;
