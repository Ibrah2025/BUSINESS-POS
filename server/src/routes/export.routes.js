const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { ROLES } = require('../../../shared/constants');
const { exportLimiter } = require('../middleware/rateLimiter');
const exportService = require('../services/export.service');

router.use(authenticate);
router.use(exportLimiter);
router.use(requireRole(ROLES.OWNER, ROLES.MANAGER));

// GET /excel - Export data as Excel
router.get('/excel', async (req, res, next) => {
  try {
    const buffer = await exportService.exportExcel(req.user.businessId, req.query);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=bizpos-export-${date}.xlsx`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// GET /pdf - Export as HTML report (open in new tab for printing)
router.get('/pdf', async (req, res, next) => {
  try {
    const html = await exportService.exportPdf(req.user.businessId, req.query);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// GET /barcode-labels - Generate barcode label page (open in new tab for printing)
router.get('/barcode-labels', async (req, res, next) => {
  try {
    const html = await exportService.generateBarcodeLabels(req.user.businessId, req.query);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
