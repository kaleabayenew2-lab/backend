const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');


// =============================
// AUTH ROUTES
// =============================

// POST /api/users/register
router.post('/register', usersController.register);

// POST /api/users/login
router.post('/login', usersController.login);

// POST /api/users/auth/logout
// Simple logout endpoint for stateless JWT/localStorage frontend
router.post('/auth/logout', (req, res) => {
  // If you use cookies for authentication
  res.clearCookie('token');
  res.json({ ok: true });
});

// Request password reset (OTP via Telegram if linked)
router.post('/request-reset', usersController.requestReset);

// Request admin-assisted password reset
router.post('/request-admin-reset', usersController.requestAdminReset);

// Confirm reset with OTP + new password
router.post('/confirm-reset', usersController.confirmReset);


// =============================
// TELEGRAM ROUTES
// =============================

// GET /api/users/check-telegram?chatId=...
router.get('/check-telegram', usersController.checkTelegramChatId);

// POST /api/users/telegram/register-contact
router.post('/telegram/register-contact', usersController.registerTelegramContact);

// GET /api/users/telegram/:chatId
router.get('/telegram/:chatId', usersController.findByTelegramChatId);


// =============================
// USER CHECK ROUTES
// =============================

// GET /api/users/check?email=...
router.get('/check', usersController.checkEmail);


// =============================
// PROFILE ROUTES
// =============================

// POST /api/users/profile
router.post('/profile', usersController.updateProfile);

// GET /api/users/:id  (Keep parameter routes near bottom)
router.get('/:id', usersController.getProfile);


// =============================
// SAVED FACILITIES
// =============================

// GET saved facilities
router.get('/:id/saved', usersController.getSavedFacilities);

// Add saved facility
router.post('/:id/saved', usersController.addSavedFacility);

// Remove saved facility
router.delete('/:id/saved/:fid', usersController.removeSavedFacility);


// =============================
// DEVICE TOKENS
// =============================

router.post('/:id/device-tokens', usersController.addDeviceToken);
router.get('/:id/device-tokens', usersController.listDeviceTokens);
router.delete('/:id/device-tokens', usersController.removeDeviceToken);


// =============================
// ADMIN ROUTES
// =============================

// List all users
router.get('/', usersController.listUsers);

// Update user
router.put('/:id', usersController.updateUser);

// Delete user
router.delete('/:id', usersController.deleteUser);

// Reset user password
router.post('/:id/reset-password', usersController.resetPassword);


module.exports = router;
