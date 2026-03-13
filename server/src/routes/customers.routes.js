const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const customersService = require('../services/customers.service');

router.use(authenticate);

// GET / - List customers (search by name/phone)
router.get('/', async (req, res, next) => {
  try {
    const result = await customersService.list(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST / - Add customer
router.post('/', async (req, res, next) => {
  try {
    const result = await customersService.create(req.user.businessId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get customer details with credit history
router.get('/:id', async (req, res, next) => {
  try {
    const result = await customersService.getById(req.user.businessId, req.params.id);
    if (!result) return res.status(404).json({ message: 'Customer not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update customer
router.put('/:id', async (req, res, next) => {
  try {
    const result = await customersService.update(req.user.businessId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete customer
router.delete('/:id', async (req, res, next) => {
  try {
    await customersService.delete(req.user.businessId, req.params.id);
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /:id/history - Purchase + credit history
router.get('/:id/history', async (req, res, next) => {
  try {
    const result = await customersService.getHistory(req.user.businessId, req.params.id, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
