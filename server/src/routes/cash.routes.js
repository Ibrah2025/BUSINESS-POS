const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const cashService = require('../services/cash.service');
const financeService = require('../services/finance.service');

router.use(authenticate);

// GET / - Get current cash balance + recent transactions
router.get('/', async (req, res, next) => {
  try {
    const result = await cashService.getBalance(req.user.businessId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /add - Add cash
router.post('/add', async (req, res, next) => {
  try {
    const result = await cashService.addCash(req.user.businessId, req.user.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /remove - Remove cash
router.post('/remove', async (req, res, next) => {
  try {
    const result = await cashService.removeCash(req.user.businessId, req.user.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /reconcile - Get reconciliation data
router.get('/reconcile', async (req, res, next) => {
  try {
    const result = await cashService.getReconciliation(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /snapshot - Full financial snapshot
router.get('/snapshot', async (req, res, next) => {
  try {
    const result = await financeService.getFinancialSnapshot(req.user.businessId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
