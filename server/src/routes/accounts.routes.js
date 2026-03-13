const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { ROLES } = require('../../../shared/constants');
const accountsService = require('../services/accounts.service');

router.use(authenticate);

// GET / - List bank accounts
router.get('/', async (req, res, next) => {
  try {
    const result = await accountsService.list(req.user.businessId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST / - Add bank account (owner only)
router.post('/', requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const result = await accountsService.create(req.user.businessId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update bank account (owner only)
router.put('/:id', requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const result = await accountsService.update(req.user.businessId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete bank account (owner only)
router.delete('/:id', requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    await accountsService.delete(req.user.businessId, req.params.id);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /:id/transactions - Get transaction history for account
router.get('/:id/transactions', async (req, res, next) => {
  try {
    const result = await accountsService.getTransactions(req.user.businessId, req.params.id, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
