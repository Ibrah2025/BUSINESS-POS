const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const whatsappService = require('../services/whatsapp.service');

router.use(authenticate);

// GET /status — connection state + QR code (if pending scan)
router.get('/status', async (req, res, next) => {
  try {
    const status = whatsappService.getStatus();
    const config = await whatsappService.getConfig(req.user.businessId);
    res.json({ ...status, config: config || null });
  } catch (err) {
    next(err);
  }
});

// POST /connect — start WhatsApp connection (generates QR)
router.post('/connect', async (req, res, next) => {
  try {
    await whatsappService.connect();
    // Give it a moment for QR to generate
    setTimeout(() => {
      res.json(whatsappService.getStatus());
    }, 2000);
  } catch (err) {
    next(err);
  }
});

// POST /disconnect — logout and clear auth state
router.post('/disconnect', async (req, res, next) => {
  try {
    await whatsappService.disconnect();
    res.json({ message: 'WhatsApp disconnected', state: 'disconnected' });
  } catch (err) {
    next(err);
  }
});

// POST /set-recipient — set the phone number to receive notifications
router.post('/set-recipient', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    const result = await whatsappService.setConfig(req.user.businessId, phone);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /test — send a test message to verify setup
router.post('/test', async (req, res, next) => {
  try {
    const config = await whatsappService.getConfig(req.user.businessId);
    if (!config?.recipient_phone) {
      return res.status(400).json({ error: 'Set recipient phone number first' });
    }
    const sent = await whatsappService.sendMessage(
      config.recipient_phone,
      'BizPOS WhatsApp notification is working! Sale alerts will appear here.'
    );
    res.json({ sent, message: sent ? 'Test message sent!' : 'Failed to send — check connection' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
