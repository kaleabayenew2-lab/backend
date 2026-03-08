const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  phone: { type: String },
  // ...existing fields...
}, { timestamps: true });

// also create explicit partial index (safer)
userSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $exists: true, $ne: null } } }
);

module.exports = mongoose.model('MobileUser', userSchema);