const Facility = require('../models/facility');
const bcrypt = require('bcryptjs');
const serviceCatalog = require('../config/serviceCatalog');

exports.list = async (req, res) => {
  try {
    const { lat, lng, radius = 5000, type } = req.query;
    const query = {};

    if (type) {
      query.type = String(type).toLowerCase();
    }

    const maxDistance = parseInt(radius, 10) || 5000;

    // If lat and lng are provided, validate and perform a geospatial near query
    if (lat !== undefined && lng !== undefined) {
      const plat = parseFloat(lat);
      const plng = parseFloat(lng);
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) {
        return res.status(400).json({ error: 'Invalid lat or lng' });
      }

      query.location = {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [plng, plat] },
          $maxDistance: maxDistance
        }
      };

      const facilities = await Facility.find(query).limit(50);
      return res.json(facilities);
    }

    const facilities = await Facility.find(query).limit(100);
    return res.json(facilities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const data = req.body;
    // normalize ownership value
    if (data.ownership) data.ownership = String(data.ownership).toLowerCase();
    if (data.ownership !== 'public' && data.ownership !== 'private') data.ownership = 'private';
    // Basic validation: require name and type
    if (!data.name || !data.type) {
      return res.status(400).json({ error: 'Missing required fields: name and type' });
    }

    // Check for existing facility name (case-insensitive)
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Facility.findOne({ name: { $regex: `^${escapeRegex(data.name)}$`, $options: 'i' } });
    if (existing) {
      return res.status(409).json({ error: 'Facility name already exists' });
    }

    // If a password is provided, hash it and store as passwordHash
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(data.password, salt);
      delete data.password;
    }
    // If an agentId is supplied (from Telegram bot), store it
    if (data.agentId) {
      data.agentId = String(data.agentId);
    }
    // If a username is provided, ensure it's unique (case-insensitive)
    if (data.username) {
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingUser = await Facility.findOne({ username: { $regex: `^${escapeRegex(String(data.username))}$`, $options: 'i' } });
      if (existingUser) return res.status(409).json({ error: 'Username already exists' });
    }
    const facility = new Facility(data);
    await facility.save();
    res.status(201).json(facility);
  } catch (err) {
    console.error(err);
    // Handle duplicate key error just in case
    if (err && err.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || 'field';
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
    const facility = await Facility.findOne({ username: username });
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
    // Try find by Mongo _id first, if not found try to find by agentId
    let facility = null;
    try {
      facility = await Facility.findById(id);
    } catch (e) {
      facility = null;
    }
    if (!facility) {
      facility = await Facility.findOne({ agentId: id });
    }
    if (!facility) return res.status(404).json({ error: 'Not found' });
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
    const query = { $or: [{ _id: id }, { agentId: id }] };
    const update = { $inc: { viewsTotal: 1 }, $set: { lastViewedAt: new Date() } };
    const f = await Facility.findOneAndUpdate(query, update, { new: true });
    if (!f) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true, viewsTotal: f.viewsTotal, lastViewedAt: f.lastViewedAt });
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
    const query = { $or: [{ _id: id }, { agentId: id }] };
    // Update aggregated rating fields
    const f = await Facility.findOne(query);
    if (!f) return res.status(404).json({ error: 'Not found' });
    const newCount = (f.ratingCount || 0) + 1;
    const newSum = (f.ratingSum || 0) + rating;
    const avg = newSum / newCount;
    f.ratingCount = newCount;
    f.ratingSum = newSum;
    f.averageRating = Math.round((avg + Number.EPSILON) * 100) / 100; // two decimals
    await f.save();
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
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await Facility.findOne({ _id: { $ne: id }, name: { $regex: `^${escapeRegex(data.name)}$`, $options: 'i' } });
      if (existing) return res.status(409).json({ error: 'Facility name already exists' });
    }
    // If updating username, ensure it's unique (case-insensitive)
    if (data.username) {
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingUser = await Facility.findOne({ _id: { $ne: id }, username: { $regex: `^${escapeRegex(String(data.username))}$`, $options: 'i' } });
      if (existingUser) return res.status(409).json({ error: 'Username already exists' });
    }
    // If password provided, hash it
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(data.password, salt);
      delete data.password;
    }
    // Allow updating by _id or by agentId
    const query = { $or: [{ _id: id }, { agentId: id }] };
    const facility = await Facility.findOneAndUpdate(query, data, { new: true, runValidators: true });
    if (!facility) return res.status(404).json({ error: 'Not found' });
    return res.json(facility);
  } catch (err) {
    console.error('facility update error', err);
    if (err && err.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || 'field';
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

    const query = { $or: [{ _id: id }, { agentId: id }] };
    const facility = await Facility.findOneAndUpdate(query, { passwordHash }, { new: true });
    if (!facility) {
      try { console.warn(`resetPassword: facility not found for id=${id}`); } catch (e) {}
      return res.status(404).json({ error: 'Not found' });
    }

    // Log outcome for operator visibility; optionally reveal plaintext when DEBUG_PASSWORDS=true
    try {
      if (process.env.DEBUG_PASSWORDS === 'true') {
        console.log(`resetPassword: facility ${facility._id} password set to: ${password}`);
      } else {
        console.log(`resetPassword: facility ${facility._id} password updated (plaintext suppressed)`);
      }
    } catch (e) { /* ignore logging failures */ }

    // Return the plaintext password so admin UI can display it once
    return res.json({ password });
  } catch (err) {
    console.error('resetPassword error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Check if a facility name exists
exports.checkName = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name parameter required' });
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Facility.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
    return res.json({ exists: !!existing });
  } catch (err) {
    console.error('checkName error', err);
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
