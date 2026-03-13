const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const returnsService = require('../services/returns.service');

router.use(authenticate);

// POST / - Create return
router.post('/', async (req, res, next) => {
  try {
    const result = await returnsService.create(req.user.businessId, req.user.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET / - List returns
router.get('/', async (req, res, next) => {
  try {
    const result = await returnsService.list(req.user.businessId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get return details
router.get('/:id', async (req, res, next) => {
  try {
    const result = await returnsService.getById(req.user.businessId, req.params.id);
    if (!result) return res.status(404).json({ message: 'Return not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
