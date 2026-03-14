const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { ROLES } = require('../../../shared/constants');
const notificationService = require('../services/notification.service');

router.use(authenticate);
router.use(requireRole(ROLES.OWNER));

// GET /preferences - Get notification preferences
router.get('/preferences', async (req, res, next) => {
  try {
    const result = await notificationService.getPreferences(req.user.businessId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /preferences - Update preferences
router.put('/preferences', async (req, res, next) => {
  try {
    const result = await notificationService.updatePreferences(req.user.businessId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /test - Send test notification
router.post('/test', async (req, res, next) => {
  try {
    const result = await notificationService.sendTest(req.user.businessId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /telegram-bot - Get Telegram bot username for linking
router.get('/telegram-bot', async (req, res) => {
  try {
    const TelegramBot = require('node-telegram-bot-api');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return res.json({ username: null });
    const bot = new TelegramBot(token);
    const me = await bot.getMe();
    res.json({ username: me.username });
  } catch {
    res.json({ username: null });
  }
});

// GET /telegram-links - List linked Telegram accounts for this business
router.get('/telegram-links', async (req, res) => {
  try {
    const telegramService = require('../services/telegram.service');
    const links = await telegramService.getLinkedChats(req.user.businessId);
    res.json({ links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /telegram-links/:chatId - Remove a linked Telegram account
router.delete('/telegram-links/:chatId', async (req, res) => {
  try {
    const telegramService = require('../services/telegram.service');
    await telegramService.unlinkChat(req.params.chatId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /telegram-invite - Generate an invite link for Telegram
router.post('/telegram-invite', async (req, res) => {
  try {
    const telegramService = require('../services/telegram.service');
    const code = telegramService.generateInvite(req.user.businessId);

    // Get bot username
    let username = null;
    try {
      const TelegramBot = require('node-telegram-bot-api');
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        const b = new TelegramBot(token);
        const me = await b.getMe();
        username = me.username;
      }
    } catch {}

    const link = username
      ? `https://t.me/${username}?start=${code}`
      : null;

    res.json({ code, link, expiresIn: '24h' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /log - Get notification log
router.get('/log', async (req, res, next) => {
  try {
    const result = await notificationService.getLog(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
