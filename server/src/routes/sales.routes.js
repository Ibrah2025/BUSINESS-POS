const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const salesService = require('../services/sales.service');
const { broadcastSale } = require('../websocket/liveTransactions');
const { notifySale } = require('../services/telegram.service');
const { notifySale: notifyWhatsApp } = require('../services/whatsapp.service');

router.use(authenticate);

// GET /today - Today's sales summary (must be before /:id)
router.get('/today', async (req, res, next) => {
  try {
    const result = await salesService.todaySummary(req.user.businessId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /calendar/:year/:month - Calendar data for month
router.get('/calendar/:year/:month', async (req, res, next) => {
  try {
    const result = await salesService.calendarData(req.user.businessId, req.params.year, req.params.month);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST / - Create new sale
router.post('/', async (req, res, next) => {
  try {
    const result = await salesService.create(req.user.businessId, req.user.id, req.body);
    const io = req.app.get('io');
    if (io) broadcastSale(io, req.user.businessId, result);
    notifySale(req.user.businessId, result);
    notifyWhatsApp(req.user.businessId, result);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET / - List sales (paginated, date range filter)
router.get('/', async (req, res, next) => {
  try {
    const result = await salesService.list(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get sale details with items and payments
router.get('/:id', async (req, res, next) => {
  try {
    const result = await salesService.getById(req.user.businessId, req.params.id);
    if (!result) return res.status(404).json({ message: 'Sale not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/void - Void a sale
router.put('/:id/void', async (req, res, next) => {
  try {
    const result = await salesService.voidSale(req.user.businessId, req.user.id, req.params.id);
    const io = req.app.get('io');
    if (io) broadcastSale(io, req.user.businessId, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
