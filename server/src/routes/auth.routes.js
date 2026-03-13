const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { ROLES } = require('../../../shared/constants');
const authService = require('../services/auth.service');
const { authLimiter } = require('../middleware/rateLimiter');

// POST /register - Register new business + owner (no auth required)
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /login - PIN login (no auth required, rate limited)
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /refresh - Refresh JWT token
router.post('/refresh', async (req, res, next) => {
  try {
    const result = await authService.refresh(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /logout - Logout (authenticated)
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await authService.logout(req.user);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// --- Staff management (owner/manager only) ---

// GET /staff - List all staff
router.get('/staff', authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res, next) => {
  try {
    const staff = await authService.listStaff(req.user.businessId);
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// POST /staff - Create staff member
router.post('/staff', authenticate, requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const result = await authService.createStaff(req.user.businessId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /staff/:id - Update staff member
router.put('/staff/:id', authenticate, requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const result = await authService.updateStaff(req.user.businessId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
