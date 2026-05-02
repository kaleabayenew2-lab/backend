// OTP routes for backend API
const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP } = require('../controllers/otpController');

// POST /api/otp/send - Send OTP
router.post('/send', sendOTP);

// POST /api/otp/verify - Verify OTP
router.post('/verify', verifyOTP);

module.exports = router;
