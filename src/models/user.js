const { registerModel, DataTypes } = require('../config/db');

// Define User model
const User = registerModel('User', {
  fullName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  phone: DataTypes.STRING,
  // Telegram linking
  telegramChatId: DataTypes.STRING,
  telegramUsername: DataTypes.STRING,
  telegramPhone: DataTypes.STRING,
  // device push tokens for FCM/APNs
  deviceTokens: { type: DataTypes.JSON, defaultValue: [] },
  // password reset OTP (6-digit) and expiry
  resetOtp: DataTypes.STRING,
  resetOtpExpires: DataTypes.DATE,
  // login OTP (6-digit) for Telegram-based login and expiry
  loginOtp: DataTypes.STRING,
  loginOtpExpires: DataTypes.DATE,
  age: DataTypes.INTEGER,
  // Saved facility references for quick access
  savedFacilities: { type: DataTypes.JSON, defaultValue: [] },
  // Basic medical profile fields
  medicalConditions: { type: DataTypes.JSON, defaultValue: [] },
  allergies: { type: DataTypes.JSON, defaultValue: [] },
  medications: { type: DataTypes.JSON, defaultValue: [] },
  systemId: { type: DataTypes.STRING, allowNull: false, unique: true },
  userId: { type: DataTypes.STRING, allowNull: false, unique: true },
  provider: { type: DataTypes.STRING, defaultValue: null },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  adminResetRequested: { type: DataTypes.BOOLEAN, defaultValue: false },
  adminResetPassword: { type: DataTypes.STRING, defaultValue: null },
  adminResetPasswordExpires: { type: DataTypes.DATE, defaultValue: null }
});

// Ensure email is stored lowercase and encrypted
const { encrypt, decrypt } = require('../utils/encryption');

User.addHook('beforeSave', (user) => {
  if (user.changed('email') && user.email) {
    user.email = encrypt(user.email.toLowerCase());
  }
  if (user.changed('phone') && user.phone) {
    user.phone = encrypt(user.phone);
  }
});

// helper to decrypt fields when returning data to clients
User.prototype.decryptFields = function () {
  try {
    if (this.email) this.email = decrypt(this.email);
    if (this.phone) this.phone = decrypt(this.phone);
  } catch (_) {}
  return this;
};

// automatically decrypt fields when a document is loaded from the database
User.addHook('afterFind', (users) => {
  if (Array.isArray(users)) {
    users.forEach(user => user.decryptFields());
  } else if (users) {
    users.decryptFields();
  }
});

module.exports = User;
