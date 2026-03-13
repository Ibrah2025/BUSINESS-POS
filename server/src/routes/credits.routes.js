const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { ROLES } = require('../../../shared/constants');
const creditsService = require('../services/credits.service');

router.use(authenticate);

// GET / - List credits (filter by type: customer/supplier, status)
router.get('/', async (req, res, next) => {
  try {
    const result = await creditsService.list(req.user.businessId, req.query);
    // If no type filter, group by type for the dashboard/credits page
    if (!req.query.type) {
      const customerCredits = result.credits.filter((c) => c.type === 'customer');
      const supplierCredits = result.credits.filter((c) => c.type === 'supplier');
      return res.json({ customerCredits, supplierCredits, total: result.total });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST / - Add credit (owner/manager)
router.post('/', requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res, next) => {
  try {
    const result = await creditsService.create(req.user.businessId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update credit
router.put('/:id', async (req, res, next) => {
  try {
    const result = await creditsService.update(req.user.businessId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /:id/payment - Record partial/full payment
router.post('/:id/payment', async (req, res, next) => {
  try {
    const result = await creditsService.recordPayment(req.user.businessId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete credit (owner only)
router.delete('/:id', requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    await creditsService.delete(req.user.businessId, req.params.id);
    res.json({ message: 'Credit deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
