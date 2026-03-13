const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const actionsService = require('../services/actions.service');

router.use(authenticate);

// GET / - List action history
router.get('/', async (req, res, next) => {
  try {
    const result = await actionsService.list(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /undo - Undo last action
router.post('/undo', async (req, res, next) => {
  try {
    const result = await actionsService.undo(req.user.businessId, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /redo - Redo last undone action
router.post('/redo', async (req, res, next) => {
  try {
    const result = await actionsService.redo(req.user.businessId, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /history - Get action history
router.get('/history', async (req, res, next) => {
  try {
    const result = await actionsService.getHistory(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
