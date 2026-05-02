const { registerModel, DataTypes } = require('../config/db');

// Define TelegramContact model
const TelegramContact = registerModel('TelegramContact', {
  chatId: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: DataTypes.STRING,
  username: DataTypes.STRING,
  linkedUser: { type: DataTypes.INTEGER, defaultValue: null },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  indexes: [
    { fields: ['chatId'] }
  ]
});

module.exports = TelegramContact;
