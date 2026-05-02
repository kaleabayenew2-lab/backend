const { registerModel, DataTypes } = require('../config/db');

// Define ChatMessage model
const ChatMessage = registerModel('ChatMessage', {
  conversationId: { type: DataTypes.STRING },
  from: { type: DataTypes.STRING, allowNull: false }, // user id or 'bot' or facility id
  to: DataTypes.STRING, // recipient id
  text: DataTypes.STRING,
  attachments: { type: DataTypes.JSON, defaultValue: [] },
  meta: { type: DataTypes.JSON, defaultValue: {} },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  indexes: [
    { fields: ['conversationId'] }
  ]
});

module.exports = ChatMessage;
