const { registerModel, DataTypes } = require('../config/db');

// Define Facility model
const Facility = registerModel('Facility', {
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  type: { type: DataTypes.ENUM('hospital', 'pharmacy'), allowNull: false },
  location: { type: DataTypes.JSON, defaultValue: { type: 'Point', coordinates: [] } },
  address: DataTypes.STRING,
  email: DataTypes.STRING,
  altPhone: { type: DataTypes.JSON, defaultValue: [] },
  phone: DataTypes.STRING,
  // Optional agent account credentials for facility management
  username: { type: DataTypes.STRING, unique: true },
  passwordHash: DataTypes.STRING,
  services: { type: DataTypes.JSON, defaultValue: [] },
  // Agent identifier created by bot during registration (short uuid)
  agentId: { type: DataTypes.STRING, unique: true },
  openingHours: DataTypes.STRING,
  // Optional classificiation by type
  hospitalType: DataTypes.STRING,
  pharmacyType: DataTypes.STRING,
  // Ownership: 'private' or 'public'
  ownership: { type: DataTypes.ENUM('private', 'public'), defaultValue: 'private' },
  notes: DataTypes.STRING,
  isEmergency: { type: DataTypes.BOOLEAN, defaultValue: false },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  // Usage statistics
  viewsTotal: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastViewedAt: DataTypes.DATE,
  // Simple rating aggregation
  ratingCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  ratingSum: { type: DataTypes.INTEGER, defaultValue: 0 },
  averageRating: { type: DataTypes.FLOAT, defaultValue: 0 },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  indexes: [
    { unique: true, fields: ['name'] },
    { fields: ['viewsTotal'] },
    { fields: ['averageRating'] },
    { fields: ['agentId'] }
  ]
});

// encrypt some fields before save and decrypt helper
const { encrypt: _encrypt, decrypt: _decrypt } = require('../utils/encryption');

Facility.addHook('beforeSave', (facility) => {
  if (facility.changed('phone') && facility.phone) {
    facility.phone = _encrypt(facility.phone);
  }
  if (facility.changed('email') && facility.email) {
    facility.email = _encrypt(facility.email);
  }
});

Facility.prototype.decryptFields = function () {
  try {
    if (this.phone) this.phone = _decrypt(this.phone);
    if (this.email) this.email = _decrypt(this.email);
  } catch (_) {}
  return this;
};

Facility.addHook('afterFind', (facilities) => {
  if (Array.isArray(facilities)) {
    facilities.forEach(facility => facility.decryptFields());
  } else if (facilities) {
    facilities.decryptFields();
  }
});

module.exports = Facility;
