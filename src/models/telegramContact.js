const mongoose = require('mongoose');

const TelegramContactSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true, index: true },
  phone: String,
  username: String,
  linkedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TelegramContact', TelegramContactSchema);
