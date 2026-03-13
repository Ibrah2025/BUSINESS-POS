const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { ROLES } = require('../../../shared/constants');
const subscriptionService = require('../services/subscription.service');

// GET /plan — Get current plan status (any authenticated user)
router.get('/plan', authenticate, async (req, res, next) => {
  try {
    const status = await subscriptionService.getPlanStatus(req.user.businessId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// POST /redeem — Redeem a subscription PIN (owner only)
router.post('/redeem', authenticate, requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.trim().length < 5) {
      return res.status(400).json({ error: { message: 'Please enter a valid PIN' } });
    }
    const result = await subscriptionService.redeemPin(req.user.businessId, pin);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /pins/generate — Generate PINs (admin/owner — for field agents)
router.post('/pins/generate', authenticate, requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const { count, days, planType, price, agentName, agentPhone } = req.body;
    const result = await subscriptionService.generatePins({
      count: Math.min(count || 10, 100), // cap at 100 per batch
      days: days || 30,
      planType: planType || 'premium',
      price: price || null,
      agentName: agentName || null,
      agentPhone: agentPhone || null,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /pins — List PINs (admin view)
router.get('/pins', authenticate, requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const { batchId, status, limit, offset } = req.query;
    const pins = await subscriptionService.listPins({
      batchId,
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    res.json(pins);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
