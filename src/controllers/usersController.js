// Public: request admin-assisted password reset. Accepts { email } and notifies admin (for demo, just returns ok)
exports.requestAdminReset = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email required' });
    const u = await User.findOne({ email: String(email).toLowerCase() });
    if (!u) return res.status(404).json({ message: 'User not found' });
    u.adminResetRequested = true;
    await u.save();
    // In a real app, notify admin (email, dashboard, etc). For now, just return ok.
    return res.json({ ok: true });
  } catch (err) {
    console.error('requestAdminReset error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
// Check if a Telegram chat ID is linked to any user
exports.checkTelegramChatId = async (req, res) => {
  try {
    const chatId = req.query.chatId;
    if (!chatId) return res.status(400).json({ message: 'Missing chatId' });
    const u = await User.findOne({ telegramChatId: String(chatId) });
    if (!u) return res.json({ linked: false });
    return res.json({ linked: true, email: u.email });
  } catch (err) {
    console.error('checkTelegramChatId error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/user');
const TelegramContact = require('../models/telegramContact');

function generateUserId() {
  // simple 6-digit numeric id
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function ensureUniqueIds() {
  // generate systemId + userId ensuring uniqueness
  let systemId = crypto.randomUUID();
  let userId = generateUserId();
  // if collision, retry (extremely unlikely)
  while (await User.findOne({ systemId })) {
    systemId = crypto.randomUUID();
  }
  while (await User.findOne({ userId })) {
    userId = generateUserId();
  }
  return { systemId, userId };
}

exports.register = async (req, res) => {
  try {

    const { fullName, email, password, phone, age, provider, idToken } = req.body;

    let resolvedEmail = email;
    let resolvedName = fullName;

    // If using Google provider, verify ID token with Google
    if (provider === 'google') {
      if (!idToken) return res.status(400).json({ message: 'Missing idToken for Google sign-in' });
      // Verify token
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      const verifyRes = await axios.get(verifyUrl).catch((e) => null);
      if (!verifyRes || !verifyRes.data || !verifyRes.data.email) {
        return res.status(400).json({ message: 'Invalid Google ID token' });
      }
      resolvedEmail = verifyRes.data.email.toLowerCase();
      resolvedName = resolvedName || verifyRes.data.name || verifyRes.data.email.split('@')[0];
    }

    if (!resolvedName || !resolvedEmail || (!password && !provider)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const emailLower = resolvedEmail.toLowerCase();
    const existing = await User.findOne({ email: emailLower });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    // If phone provided, validate Ethiopian E.164 format and check for existing phone to avoid duplicate-key DB error
    if (phone) {
      const phoneRegex = /^\+251\d{9}$/;
      if (!phoneRegex.test(String(phone))) {
        return res.status(400).json({ message: 'Phone must be in format +251 followed by 9 digits (Ethiopia)' });
      }
      const existingPhone = await User.findOne({ phone: phone });
      if (existingPhone) return res.status(409).json({ message: 'Phone already registered', field: 'phone', value: phone });
    }

    const { systemId, userId } = await ensureUniqueIds();

    const passwordHash = password ? await bcrypt.hash(password, 10) : 'SOCIAL';

    const u = new User({
      fullName: resolvedName,
      email: emailLower,
      passwordHash,
      phone,
      age,
      provider: provider || null,
      systemId,
      userId
    });

    await u.save();

    // create token
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: u._id, systemId: u.systemId }, secret, { expiresIn: '30d' });

    const out = {
      id: u._id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      age: u.age,
      systemId: u.systemId,
      userId: u.userId,
      provider: u.provider,
      token
    };

    res.status(201).json(out);
  } catch (err) {
    console.error('register error', err);
    // Handle duplicate key (unique index) errors from MongoDB
    if (err && err.code === 11000) {
      const keyValue = err.keyValue || {};
      const field = Object.keys(keyValue)[0] || 'field';
      const value = keyValue[field];
      return res.status(409).json({ message: `${field} already registered`, field, value });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, provider, idToken } = req.body;

    // Social/provider login
    if (provider === 'google') {
      if (!idToken) return res.status(400).json({ message: 'Missing idToken for Google login' });
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      const verifyRes = await axios.get(verifyUrl).catch((e) => null);
      if (!verifyRes || !verifyRes.data || !verifyRes.data.email) {
        return res.status(400).json({ message: 'Invalid Google ID token' });
      }
      const emailLower = verifyRes.data.email.toLowerCase();
      // find or create user
      let u = await User.findOne({ email: emailLower });
      if (!u) {
        const { systemId, userId } = await ensureUniqueIds();
        u = new User({
          fullName: verifyRes.data.name || emailLower.split('@')[0],
          email: emailLower,
          passwordHash: 'SOCIAL',
          provider: 'google',
          systemId,
          userId
        });
        await u.save();
      }
      const secret = process.env.JWT_SECRET || 'dev_secret';
      const token = jwt.sign({ id: u._id, systemId: u.systemId }, secret, { expiresIn: '30d' });
      return res.json({ id: u._id, fullName: u.fullName, email: u.email, phone: u.phone, age: u.age, systemId: u.systemId, userId: u.userId, provider: u.provider, token });
    }

    // Email/password login
    if (!email || !password) return res.status(400).json({ message: 'Missing credentials' });

    const u = await User.findOne({ email: email.toLowerCase() });
    if (!u) return res.status(401).json({ message: 'Invalid credentials' });


    // If user is using admin reset password, check expiry and match
    if (u.adminResetPassword && u.adminResetPasswordExpires) {
      const now = new Date();
      if (password === u.adminResetPassword && now < u.adminResetPasswordExpires) {
        // Valid admin reset password, allow login and clear fields
        u.adminResetPassword = null;
        u.adminResetPasswordExpires = null;
        await u.save();
      } else if (password === u.adminResetPassword && now >= u.adminResetPasswordExpires) {
        return res.status(401).json({ message: 'Default password expired. Request admin reset again.' });
      } else {
        // Fallback to normal password check
        const ok = await bcrypt.compare(password, u.passwordHash || '');
        if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
      }
    } else {
      // Normal password check
      const ok = await bcrypt.compare(password, u.passwordHash || '');
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    }

    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: u._id, systemId: u.systemId }, secret, { expiresIn: '30d' });

    res.json({
      id: u._id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      age: u.age,
      systemId: u.systemId,
      userId: u.userId,
      provider: u.provider,
      token
    });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update profile: accepts { id, fullName, phone, age }
exports.updateProfile = async (req, res) => {
  try {
    const { id, fullName, phone, age, password } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (fullName) u.fullName = fullName;
    if (phone) {
      const phoneRegex = /^\+251\d{9}$/;
      if (!phoneRegex.test(String(phone))) return res.status(400).json({ message: 'Phone must be in format +251 followed by 9 digits (Ethiopia)' });
      u.phone = phone;
    }
    if (age !== undefined) u.age = age;
    if (password) {
      u.passwordHash = await bcrypt.hash(password, 10);
      // Clear admin reset fields if password is changed
      u.adminResetPassword = null;
      u.adminResetPasswordExpires = null;
    }
    await u.save();
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: u._id, systemId: u.systemId }, secret, { expiresIn: '30d' });
    return res.json({ id: u._id, fullName: u.fullName, email: u.email, phone: u.phone, age: u.age, systemId: u.systemId, userId: u.userId, provider: u.provider, token });
  } catch (err) {
    console.error('updateProfile error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get basic profile by id
exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    return res.json({ id: u._id, fullName: u.fullName, email: u.email, phone: u.phone, telegramChatId: u.telegramChatId, telegramUsername: u.telegramUsername, telegramPhone: u.telegramPhone });
  } catch (err) {
    console.error('getProfile error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Check if an email exists (query param: email)
exports.checkEmail = async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ message: 'email required' });
    const u = await User.findOne({ email: String(email).toLowerCase() });
    if (!u) return res.json({ exists: false });
    // Add adminResetPassword and adminResetPasswordExpires if available and not expired
    let adminResetPassword = null;
    let adminResetPasswordExpires = null;
    if (u.adminResetPassword && u.adminResetPasswordExpires) {
      const now = new Date();
      if (now < u.adminResetPasswordExpires) {
        adminResetPassword = u.adminResetPassword;
        adminResetPasswordExpires = u.adminResetPasswordExpires;
      }
    }
    return res.json({
      exists: true,
      telegramLinked: !!u.telegramChatId,
      telegramUsername: u.telegramUsername || null,
      adminResetPassword,
      adminResetPasswordExpires
    });
  } catch (err) {
    console.error('checkEmail error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register a Telegram contact posted by the bot: { phone, chatId, telegramUsername }
exports.registerTelegramContact = async (req, res) => {
  try {
    let { phone, email, chatId, telegramUsername } = req.body || {};
    // If email is provided, look up user by email and get phone
    let user = null;
    if (email && !phone) {
      user = await User.findOne({ email: String(email).toLowerCase() });
      if (!user) return res.status(404).json({ message: 'No user with that email' });
      phone = user.phone;
    }
    if (!phone || !chatId) return res.status(400).json({ message: 'phone and chatId required' });
    // normalize phone: keep only digits
    const norm = String(phone).replace(/[^0-9]/g, '');
    // Prepare suffix matches (last 9 and last 10 digits) to tolerate country code differences
    const suffix9 = norm.length > 9 ? norm.slice(-9) : norm;
    const suffix10 = norm.length > 10 ? norm.slice(-10) : norm;

    const queries = [
      { phone: { $regex: norm + '$' } },
      { phone: { $regex: suffix9 + '$' } },
    ];
    if (suffix10 != suffix9) queries.push({ phone: { $regex: suffix10 + '$' } });

    // try to find user by matching different phone suffixes
    if (!user) {
      user = await User.findOne({ $or: queries });
      if (!user) {
        // try exact full match as last resort
        user = await User.findOne({ phone: phone });
      }
    }
    if (!user) return res.status(404).json({ message: 'No user with that phone or email' });
    user.telegramChatId = String(chatId);
    if (telegramUsername) user.telegramUsername = String(telegramUsername);
    user.telegramPhone = norm;
    await user.save();
    // also upsert into TelegramContact collection
    try {
      let tc = await TelegramContact.findOne({ chatId: String(chatId) });
      if (!tc) tc = new TelegramContact({ chatId: String(chatId), phone: norm, username: telegramUsername });
      else {
        tc.phone = norm || tc.phone;
        tc.username = telegramUsername || tc.username;
      }
      tc.linkedUser = user._id;
      await tc.save();
    } catch (e) {
      console.warn('Failed to upsert TelegramContact:', e && e.message ? e.message : e);
    }
    return res.json({ ok: true, id: user._id, telegramChatId: user.telegramChatId });
  } catch (err) {
    console.error('registerTelegramContact error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Find a user by Telegram chatId
exports.findByTelegramChatId = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!chatId) return res.status(400).json({ message: 'Missing chatId' });
    const u = await User.findOne({ telegramChatId: String(chatId) });
    if (!u) return res.status(404).json({ message: 'Not found' });
    return res.json({ id: u._id, fullName: u.fullName, email: u.email, phone: u.phone, telegramChatId: u.telegramChatId });
  } catch (err) {
    console.error('findByTelegramChatId error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get saved facilities for a user (populated)
exports.getSavedFacilities = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const u = await User.findById(id).populate('savedFacilities');
    if (!u) return res.status(404).json({ message: 'User not found' });
    return res.json({ saved: u.savedFacilities || [] });
  } catch (err) {
    console.error('getSavedFacilities error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a saved facility by id
exports.addSavedFacility = async (req, res) => {
  try {
    const { id } = req.params; // user id
    const { facilityId } = req.body;
    if (!id || !facilityId) return res.status(400).json({ message: 'Missing parameters' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    // avoid duplicates
    const exists = (u.savedFacilities || []).some(f => f.toString() === facilityId.toString());
    if (!exists) u.savedFacilities = (u.savedFacilities || []).concat([facilityId]);
    await u.save();
    const populated = await User.findById(id).populate('savedFacilities');
    return res.json({ saved: populated.savedFacilities || [] });
  } catch (err) {
    console.error('addSavedFacility error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove saved facility
exports.removeSavedFacility = async (req, res) => {
  try {
    const { id, fid } = req.params;
    if (!id || !fid) return res.status(400).json({ message: 'Missing parameters' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    u.savedFacilities = (u.savedFacilities || []).filter(f => f.toString() !== fid.toString());
    await u.save();
    const populated = await User.findById(id).populate('savedFacilities');
    return res.json({ saved: populated.savedFacilities || [] });
  } catch (err) {
    console.error('removeSavedFacility error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

  // Device token management: add, list, remove
  exports.addDeviceToken = async (req, res) => {
    try {
      const { id } = req.params;
      const { token, platform } = req.body || {};
      if (!id || !token) return res.status(400).json({ message: 'Missing user id or token' });
      const u = await User.findById(id);
      if (!u) return res.status(404).json({ message: 'User not found' });
      // avoid duplicates
      u.deviceTokens = u.deviceTokens || [];
      const exists = u.deviceTokens.some(t => t && t.token === token);
      if (!exists) u.deviceTokens.push({ token: String(token), platform: platform || 'unknown', addedAt: new Date() });
      await u.save();
      return res.json({ ok: true, deviceTokens: u.deviceTokens });
    } catch (err) {
      console.error('addDeviceToken error', err);
      res.status(500).json({ message: 'Server error' });
    }
  };

  exports.listDeviceTokens = async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ message: 'Missing id' });
      const u = await User.findById(id, 'deviceTokens');
      if (!u) return res.status(404).json({ message: 'User not found' });
      return res.json({ deviceTokens: u.deviceTokens || [] });
    } catch (err) {
      console.error('listDeviceTokens error', err);
      res.status(500).json({ message: 'Server error' });
    }
  };

  exports.removeDeviceToken = async (req, res) => {
    try {
      const { id } = req.params;
      // token may be in body or query
      const token = (req.body && req.body.token) || req.query.token;
      if (!id || !token) return res.status(400).json({ message: 'Missing user id or token' });
      const u = await User.findById(id);
      if (!u) return res.status(404).json({ message: 'User not found' });
      u.deviceTokens = (u.deviceTokens || []).filter(t => t && t.token !== token);
      await u.save();
      return res.json({ ok: true, deviceTokens: u.deviceTokens });
    } catch (err) {
      console.error('removeDeviceToken error', err);
      res.status(500).json({ message: 'Server error' });
    }
  };

// Admin: list only users who requested admin reset
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({ adminResetRequested: true }, 'fullName email phone roles isActive createdAt userId systemId telegramChatId telegramUsername');
    return res.json({ users });
  } catch (err) {
    console.error('listUsers error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: update a user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, roles, isActive } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (fullName !== undefined) u.fullName = fullName;
    if (email !== undefined) u.email = String(email).toLowerCase();
    if (phone !== undefined) u.phone = phone;
    if (roles !== undefined) u.roles = roles;
    if (isActive !== undefined) u.isActive = isActive;
    await u.save();
    return res.json({ id: u._id, fullName: u.fullName, email: u.email, phone: u.phone, roles: u.roles, isActive: u.isActive });
  } catch (err) {
    console.error('updateUser error', err);
    if (err && err.code === 11000) {
      const keyValue = err.keyValue || {};
      const field = Object.keys(keyValue)[0] || 'field';
      const value = keyValue[field];
      return res.status(409).json({ message: `${field} already registered`, field, value });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: delete a user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    await User.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('deleteUser error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: reset a user's password and set to fixed default 'Kale@1513', and clear adminResetRequested
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    // Generate a random 10-character password
    const defaultPassword = Math.random().toString(36).slice(-10) + Math.floor(Math.random()*10);
    const hash = await bcrypt.hash(defaultPassword, 10);
    u.passwordHash = hash;
    u.adminResetRequested = false;
    u.adminResetPassword = defaultPassword;
    u.adminResetPasswordExpires = new Date(Date.now() + 60 * 1000); // 1 minute from now
    await u.save();
    return res.json({ ok: true, password: defaultPassword });
  } catch (err) {
    console.error('resetPassword error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public: request a password reset. Accepts { email } and if user has telegram linked, sends OTP there.
exports.requestReset = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email required' });
    const u = await User.findOne({ email: String(email).toLowerCase() });
    if (!u) return res.status(404).json({ message: 'User not found' });
    // generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    u.resetOtp = otp;
    u.resetOtpExpires = expires;
    await u.save();

    // Try to send OTP via Telegram bot HTTP API if available
    const BOT_API_BASE = process.env.BOT_API_BASE || 'http://localhost:3001';
    if (u.telegramChatId) {
      try {
        const text = `Your FindMed password reset code is: ${otp}. It expires in 30 minutes.`;
        const botResp = await axios.post(`${BOT_API_BASE}/send`, { chatId: u.telegramChatId, text }, { timeout: 5000 }).catch(e => ({ error: e }));
        if (botResp && botResp.error) {
          console.warn('Failed to send OTP via bot (request error):', botResp.error && botResp.error.message ? botResp.error.message : botResp.error);
          return res.json({ ok: false, via: 'telegram', telegramChatId: u.telegramChatId, telegramUsername: u.telegramUsername || null, message: `Failed to send via Telegram: ${botResp.error.message || 'request failed'}` });
        }
        const data = botResp && botResp.data ? botResp.data : null;
        if (data && data.ok) {
          return res.json({ ok: true, via: 'telegram', telegramChatId: u.telegramChatId, telegramUsername: u.telegramUsername || null });
        }
        // bot responded but indicated failure
        return res.json({ ok: false, via: 'telegram', telegramChatId: u.telegramChatId, telegramUsername: u.telegramUsername || null, message: (data && data.message) ? data.message : 'Bot failed to deliver message' });
      } catch (e) {
        console.warn('Failed to send OTP via bot:', e && e.message ? e.message : e);
        return res.json({ ok: false, via: 'telegram', telegramChatId: u.telegramChatId, telegramUsername: u.telegramUsername || null, message: `Failed to send via Telegram: ${e && e.message ? e.message : e}` });
      }
    }
    // Not linked to telegram
    return res.json({ ok: true, via: 'none', message: 'User not linked to Telegram; request admin reset or wait 30 minutes' });
  } catch (err) {
    console.error('requestReset error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public: confirm reset with OTP and new password: { email, otp, newPassword }
exports.confirmReset = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'email, otp and newPassword required' });
    const u = await User.findOne({ email: String(email).toLowerCase() });
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (!u.resetOtp || !u.resetOtpExpires) return res.status(400).json({ message: 'No pending reset request' });
    if (String(u.resetOtp) !== String(otp)) return res.status(400).json({ message: 'Invalid code' });
    if (new Date() > new Date(u.resetOtpExpires)) return res.status(400).json({ message: 'Code expired' });
    // set new password
    const hash = await bcrypt.hash(String(newPassword), 10);
    u.passwordHash = hash;
    u.resetOtp = undefined;
    u.resetOtpExpires = undefined;
    await u.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error('confirmReset error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
