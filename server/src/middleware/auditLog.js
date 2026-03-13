/**
 * Audit trail middleware for financial operations.
 * Logs POST/PUT/DELETE on sensitive endpoints to action_history table.
 */
const db = require('../config/database');
const logger = require('./logger');

const AUDITED_PATHS = ['/api/sales', '/api/credits', '/api/expenses', '/api/cash', '/api/accounts'];
const AUDITED_METHODS = ['POST', 'PUT', 'DELETE'];

function auditLog(req, res, next) {
  const shouldAudit =
    AUDITED_METHODS.includes(req.method) &&
    AUDITED_PATHS.some((p) => req.originalUrl.startsWith(p));

  if (!shouldAudit) {
    return next();
  }

  // Capture after response is sent so we know the status
  const originalEnd = res.end;
  res.end = function (...args) {
    originalEnd.apply(res, args);

    const userId = req.user?.id || null;
    const businessId = req.user?.businessId || null;

    const entry = {
      user_id: userId,
      business_id: businessId,
      action_type: `${req.method} ${req.originalUrl}`,
      entity_type: 'audit',
      description: `${req.method} ${req.originalUrl} -> ${res.statusCode}`,
      data: JSON.stringify({}),
      reverse_data: JSON.stringify({}),
      ip_address: req.ip || req.connection?.remoteAddress,
      created_at: new Date(),
    };

    // Fire-and-forget insert; don't block the response
    db('action_history')
      .insert(entry)
      .catch((err) => logger.error('Audit log write failed', err));
  };

  next();
}

module.exports = auditLog;
