const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { ROLES } = require('../../../shared/constants');
const businessService = require('../services/business.service');

router.use(authenticate);

// GET / - Get current business info
router.get('/', async (req, res, next) => {
  try {
    const result = await businessService.getById(req.user.businessId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT / - Update business (owner only)
router.put('/', requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const result = await businessService.update(req.user.businessId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /onboarding - Complete onboarding setup (owner only)
router.post('/onboarding', requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const result = await businessService.completeOnboarding(req.user.businessId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /settings - Get settings
router.get('/settings', async (req, res, next) => {
  try {
    const result = await businessService.getSettings(req.user.businessId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /settings - Update settings (owner only)
router.put('/settings', requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const result = await businessService.updateSettings(req.user.businessId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
