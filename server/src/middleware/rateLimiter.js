const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: { message: 'Too many attempts, try again in 15 minutes' } }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: { message: 'Too many requests, slow down' } }
});

const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: { message: 'Too many export requests, try again in a minute' } }
});

module.exports = { authLimiter, apiLimiter, exportLimiter };
