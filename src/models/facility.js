const mongoose = require('mongoose');

const FacilitySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['hospital','pharmacy'], required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' } // [lng, lat]
  },
  address: String,
  email: String,
  altPhone: { type: [String], default: [] },
  phone: String,
  // Optional agent account credentials for facility management
  username: { type: String, unique: true, sparse: true },
  passwordHash: String,
  services: [String],
  // Agent identifier created by bot during registration (short uuid)
  agentId: { type: String, unique: true, sparse: true, index: true },
  openingHours: String,
  // Optional classificiation by type
  hospitalType: String,
  pharmacyType: String,
  // Ownership: 'private' or 'public'
  ownership: { type: String, enum: ['private', 'public'], default: 'private' },
  notes: String,
  isEmergency: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  // Usage statistics
  viewsTotal: { type: Number, default: 0, index: true },
  lastViewedAt: { type: Date },
  // Simple rating aggregation
  ratingCount: { type: Number, default: 0 },
  ratingSum: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0, index: true },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure a unique index on name (case-sensitive index at DB level). For case-insensitive checks
// we also perform a lookup in controller using case-insensitive regex.
FacilitySchema.index({ name: 1 }, { unique: true });
// Ensure GeoJSON `location` field has a 2dsphere index so $nearSphere queries work
FacilitySchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Facility', FacilitySchema);
