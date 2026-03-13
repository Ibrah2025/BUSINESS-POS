const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const syncService = require('../services/sync.service');

router.use(authenticate);

// POST /push - Push offline changes to server
router.post('/push', async (req, res, next) => {
  try {
    const result = await syncService.push(req.user.businessId, req.user.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /pull - Pull changes since last sync (delta sync)
router.get('/pull', async (req, res, next) => {
  try {
    const result = await syncService.pull(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
