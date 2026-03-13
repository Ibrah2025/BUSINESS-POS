const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { ROLES } = require('../../../shared/constants');
const inventoryService = require('../services/inventory.service');
const { broadcastStockUpdate } = require('../websocket/liveTransactions');

router.use(authenticate);

// GET /barcode/:code - Lookup by barcode (must be before /:id)
router.get('/barcode/:code', async (req, res, next) => {
  try {
    const result = await inventoryService.findByBarcode(req.user.businessId, req.params.code);
    if (!result) return res.status(404).json({ message: 'Product not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /low-stock - Products below threshold
router.get('/low-stock', async (req, res, next) => {
  try {
    const result = await inventoryService.getLowStock(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /bulk-import - CSV/Excel import (owner only)
router.post('/bulk-import', requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    const result = await inventoryService.bulkImport(req.user.businessId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET / - List products (paginated, with search/category filter)
router.get('/', async (req, res, next) => {
  try {
    const result = await inventoryService.list(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get single product
router.get('/:id', async (req, res, next) => {
  try {
    const result = await inventoryService.getById(req.user.businessId, req.params.id);
    if (!result) return res.status(404).json({ message: 'Product not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST / - Add product (owner/manager)
router.post('/', requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res, next) => {
  try {
    const result = await inventoryService.create(req.user.businessId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update product (owner/manager)
router.put('/:id', requireRole(ROLES.OWNER, ROLES.MANAGER), async (req, res, next) => {
  try {
    const result = await inventoryService.update(req.user.businessId, req.params.id, req.body);
    const io = req.app.get('io');
    if (io) broadcastStockUpdate(io, req.user.businessId, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Soft delete product (owner only)
router.delete('/:id', requireRole(ROLES.OWNER), async (req, res, next) => {
  try {
    await inventoryService.softDelete(req.user.businessId, req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
