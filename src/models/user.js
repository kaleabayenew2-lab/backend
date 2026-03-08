const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  phone: String,
  // Telegram linking
  telegramChatId: String,
  telegramUsername: String,
  telegramPhone: String,
  // device push tokens for FCM/APNs
  deviceTokens: { type: [{ token: String, platform: String }], default: [] },
  // password reset OTP (6-digit) and expiry
  resetOtp: String,
  resetOtpExpires: Date,
  age: Number,
  // Saved facility references for quick access
  savedFacilities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Facility' }],
  // Basic medical profile fields
  medicalConditions: { type: [String], default: [] },
  allergies: { type: [String], default: [] },
  medications: { type: [String], default: [] },
  systemId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, unique: true, index: true },
  provider: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  adminResetRequested: { type: Boolean, default: false },
  adminResetPassword: { type: String, default: null },
  adminResetPasswordExpires: { type: Date, default: null }
});

// Ensure email is stored lowercase
UserSchema.pre('save', function (next) {
  if (this.email) this.email = this.email.toLowerCase();
  next();
});

module.exports = mongoose.model('User', UserSchema);
