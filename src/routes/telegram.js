const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegramController');

// GET /api/telegram/contacts/:chatId
router.get('/contacts/:chatId', telegramController.getByChatId);

// POST /api/telegram/contacts  -- upsert contact
router.post('/contacts', telegramController.upsertContact);

module.exports = router;
