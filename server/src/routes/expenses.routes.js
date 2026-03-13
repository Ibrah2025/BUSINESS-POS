const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { ROLES } = require('../../../shared/constants');
const expensesService = require('../services/expenses.service');

router.use(authenticate);

// GET /summary - Monthly totals by category
router.get('/summary', async (req, res, next) => {
  try {
    const result = await expensesService.getSummary(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET / - List expenses (filter by category, date range)
router.get('/', async (req, res, next) => {
  try {
    const result = await expensesService.list(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST / - Add expense
router.post('/', async (req, res, next) => {
  try {
    const result = await expensesService.create(req.user.businessId, req.user.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update expense (owner/manager)
router.put('/:id', requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res, next) => {
  try {
    const result = await expensesService.update(req.user.businessId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete expense (owner only)
router.delete('/:id', requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    await expensesService.delete(req.user.businessId, req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
