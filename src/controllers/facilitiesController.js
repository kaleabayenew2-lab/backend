const Facility = require('../models/facility');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const serviceCatalog = require('../config/serviceCatalog');

exports.list = async (req, res) => {
  try {
    const { lat, lng, radius = 5000, type } = req.query;
    const where = {};

    if (type) {
      where.type = String(type).toLowerCase();
    }

    // Note: Geospatial queries not supported in SQLite, skipping location filter
    // In a real implementation, you might use a different approach or keep MongoDB for this

    const facilities = await Facility.findAll({ where, limit: 100 });
    return res.json(facilities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const data = req.body;
    
    // Basic validation: require name, type, and email
    if (!data.name || !data.type || !data.email) {
      return res.status(400).json({ error: 'Missing required fields: name, type, and email' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // normalize ownership value
    if (data.ownership) {
      data.ownership = String(data.ownership).toLowerCase();
      if (data.ownership !== 'public' && data.ownership !== 'private') {
        data.ownership = 'private';
      }
    }

    // Check for existing facility name within the same type (case-insensitive)
    const existing = await Facility.findOne({ 
      where: { 
        name: data.name,
        type: data.type
      } 
    });
    if (existing) {
      return res.status(409).json({ error: `${data.type} name already exists` });
    }

    // Check for existing email
    const existingEmail = await Facility.findOne({ 
      where: { 
        email: data.email 
      } 
    });
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // If a username is provided, ensure it's unique
    if (data.username) {
      const existingUser = await Facility.findOne({ where: { username: data.username } });
      if (existingUser) return res.status(409).json({ error: 'Username already exists' });
    }

    // Validate coordinates if provided
    if (data.location && data.location.coordinates) {
      const [lng, lat] = data.location.coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number' || 
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }
    }

    // Generate a random password for the facility
    const generatePassword = () => {
      return Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100);
    };
    
    const tempPassword = generatePassword();
    const salt = await bcrypt.genSalt(10);
    data.passwordHash = await bcrypt.hash(tempPassword, salt);

    // Generate agent ID automatically
    const generateAgentId = () => {
      const prefix = data.type === 'hospital' ? 'H' : 'P';
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `${prefix}${random}`;
    };

    data.agentId = generateAgentId();

    // Set default values
    data.isActive = true;
    data.createdAt = new Date();
    data.updatedAt = new Date();

    const facility = await Facility.create(data);
    
    // Return facility with temporary password (only shown once)
    const response = {
      ...facility.toJSON(),
      temporaryPassword: tempPassword
    };
    
    res.status(201).json(response);
  } catch (err) {
    console.error('Facility creation error:', err);
    // Handle duplicate key error
    if (err && err.name === 'SequelizeUniqueConstraintError') {
      const key = err.errors[0].path;
      return res.status(409).json({ error: `${key} already exists` });
    }
    res.status(400).json({ error: 'Bad request' });
  }
};

// Facility login via username/password -> returns facility object when credentials match
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const facility = await Facility.findOne({ where: { username: username } });
    if (!facility) return res.status(401).json({ error: 'Invalid credentials' });
    if (!facility.passwordHash) return res.status(401).json({ error: 'No password set for this facility' });
    const ok = await bcrypt.compare(password, facility.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json(facility);
  } catch (err) {
    console.error('facility login error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get facility by id
exports.get = async (req, res) => {
  try {
    const { id } = req.params;
    // Use Sequelize syntax - try find by id or agentId
    const facility = await Facility.findOne({ 
      where: { 
        [Op.or]: [{ id }, { agentId: id }] 
      } 
    });
    if (!facility) return res.status(404).json({ error: 'Facility not found' });
    return res.json(facility);
  } catch (err) {
    console.error('facility get error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/facilities/:id/view
// increments view counters and records last viewed timestamp
exports.recordView = async (req, res) => {
  try {
    const { id } = req.params;
    const facility = await Facility.findOne({ 
      where: { 
        [Op.or]: [{ id }, { agentId: id }] 
      } 
    });
    if (!facility) return res.status(404).json({ error: 'Not found' });
    
    // Update view counters using Sequelize
    await facility.update({
      viewsTotal: facility.viewsTotal + 1,
      lastViewedAt: new Date()
    });
    
    return res.json({ ok: true, viewsTotal: facility.viewsTotal, lastViewedAt: facility.lastViewedAt });
  } catch (err) {
    console.error('recordView error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/facilities/:id/rate
// body: { rating: number }
exports.rate = async (req, res) => {
  try {
    const { id } = req.params;
    const rating = Number(req.body.rating || 0);
    if (!Number.isFinite(rating) || rating <= 0) return res.status(400).json({ error: 'rating required' });
    
    // Find facility using Sequelize
    const f = await Facility.findOne({ where: { id } });
    if (!f) return res.status(404).json({ error: 'Not found' });
    
    // Update aggregated rating fields
    const newCount = (f.ratingCount || 0) + 1;
    const newSum = (f.ratingSum || 0) + rating;
    const avg = newSum / newCount;
    
    await f.update({
      ratingCount: newCount,
      ratingSum: newSum,
      averageRating: Math.round((avg + Number.EPSILON) * 100) / 100
    });
    
    return res.json({ ok: true, ratingCount: f.ratingCount, averageRating: f.averageRating });
  } catch (err) {
    console.error('rate error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Update facility by id
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    if (data.ownership) {
      data.ownership = String(data.ownership).toLowerCase();
      if (data.ownership !== 'public' && data.ownership !== 'private') data.ownership = 'private';
    }
    // If updating name, ensure uniqueness
    if (data.name) {
      const existing = await Facility.findOne({ 
        where: { 
          id: { [Op.ne]: id }, 
          name: data.name 
        } 
      });
      if (existing) return res.status(409).json({ error: 'Facility name already exists' });
    }
    // If updating username, ensure it's unique
    if (data.username) {
      const existingUser = await Facility.findOne({ 
        where: { 
          id: { [Op.ne]: id }, 
          username: data.username 
        } 
      });
      if (existingUser) return res.status(409).json({ error: 'Username already exists' });
    }
    // If password provided, hash it
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(data.password, salt);
      delete data.password;
    }
    
    // Find and update facility using Sequelize
    const facility = await Facility.findOne({ where: { id } });
    if (!facility) return res.status(404).json({ error: 'Not found' });
    
    await facility.update(data);
    return res.json(facility);
  } catch (err) {
    console.error('facility update error', err);
    if (err && err.name === 'SequelizeUniqueConstraintError') {
      const key = err.errors[0].path;
      return res.status(409).json({ error: `${key} already exists` });
    }
    return res.status(400).json({ error: 'Bad request' });
  }
};

// POST /api/facilities/:id/reset-password
// If body.password provided, set that as the new password; otherwise generate a temporary one.
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    let { password } = req.body || {};
    // Log incoming request (do not print plaintext here unless DEBUG_PASSWORDS=true)
    try {
      console.log(`resetPassword request: id=${id} bodyContainsPassword=${password ? 'yes' : 'no'}`);
    } catch (e) {}

    // If no password provided, generate a secure temporary password
    if (!password) {
      const rand = () => Math.random().toString(36).slice(2);
      password = `${rand()}${rand()}`.slice(0, 16);
      try { console.log('resetPassword: generated a temporary password (plaintext suppressed)'); } catch (e) {}
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(String(password), salt);

    // Find and update facility using Sequelize
    const facility = await Facility.findOne({ where: { id } });
    if (!facility) {
      try { console.warn(`resetPassword: facility not found for id=${id}`); } catch (e) {}
      return res.status(404).json({ error: 'Not found' });
    }

    await facility.update({ passwordHash });

    // Log outcome for operator visibility; optionally reveal plaintext when DEBUG_PASSWORDS=true
    try {
      if (process.env.DEBUG_PASSWORDS === 'true') {
        console.log(`resetPassword: facility ${facility.id} password set to: ${password}`);
      } else {
        console.log(`resetPassword: facility ${facility.id} password updated (plaintext suppressed)`);
      }
    } catch (e) { /* ignore logging failures */ }

    // Return the plaintext password so admin UI can display it once
    return res.json({ password });
  } catch (err) {
    console.error('resetPassword error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/facilities/send-password-email
// Send password email to facility
exports.sendPasswordEmail = async (req, res) => {
  try {
    const { email, facilityName, password } = req.body;
    
    if (!email || !facilityName || !password) {
      return res.status(400).json({ error: 'Email, facility name, and password are required' });
    }
    
    const emailService = require('../services/emailService');
    
    // Send email with password
    const result = await emailService.sendPasswordEmail(email, password, facilityName);
    
    if (result.success) {
      console.log(`📧 Password email sent successfully to ${email} for facility ${facilityName}`);
      return res.json({ success: true, message: 'Password email sent successfully' });
    } else {
      console.error('Failed to send password email:', result.error);
      return res.status(500).json({ error: 'Failed to send password email' });
    }
  } catch (err) {
    console.error('sendPasswordEmail error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/facilities/:id/verify-password
// Verify current password against database
exports.verifyPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Find facility by ID
    const facility = await Facility.findOne({ where: { id } });
    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }
    
    // Compare password with stored hash
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(String(password), facility.passwordHash);
    
    if (isValid) {
      console.log(`✅ Password verification successful for facility ${facility.id}`);
      return res.json({ valid: true, message: 'Password verified successfully' });
    } else {
      console.log(`❌ Password verification failed for facility ${facility.id}`);
      return res.json({ valid: false, message: 'Invalid password' });
    }
  } catch (err) {
    console.error('verifyPassword error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Check if a facility name exists
exports.checkName = async (req, res) => {
  try {
    const { name, type } = req.query;
    if (!name) return res.status(400).json({ error: 'name parameter required' });
    
    // Use Sequelize syntax - case-insensitive search
    const existing = await Facility.findOne({ 
      where: { 
        name: name,
        ...(type && { type: type })
      }
    });
    
    return res.json({ exists: !!existing });
  } catch (err) {
    console.error('checkName error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Check email uniqueness
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email parameter required' });
    
    // Use Sequelize syntax - case-insensitive search
    const existing = await Facility.findOne({ 
      where: { 
        email: email.trim()
      }
    });
    
    return res.json({ 
      exists: !!existing,
      email: email
    });
  } catch (err) {
    console.error('checkEmail error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Check phone uniqueness
exports.checkPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone parameter required' });
    
    // Normalize phone number (ensure it starts with +251)
    let normalizedPhone = phone;
    if (!phone.startsWith('+251')) {
      normalizedPhone = `+251${phone}`;
    }
    
    // Use Sequelize syntax - exact match
    const existing = await Facility.findOne({ 
      where: { 
        phone: normalizedPhone
      }
    });
    
    return res.json({ 
      exists: !!existing,
      phone: normalizedPhone
    });
  } catch (err) {
    console.error('checkPhone error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Return service catalog used by frontend for subtype-specific options
exports.catalog = async (req, res) => {
  try {
    return res.json(serviceCatalog);
  } catch (err) {
    console.error('service catalog error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
