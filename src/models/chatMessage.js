const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  conversationId: { type: String, index: true },
  from: { type: String, required: true }, // user id or 'bot' or facility id
  to: { type: String }, // recipient id
  text: { type: String },
  attachments: { type: [String], default: [] },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
