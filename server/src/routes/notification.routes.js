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
