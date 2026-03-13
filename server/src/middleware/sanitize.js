/**
 * Input sanitization middleware.
 * - Strips HTML tags from string inputs
 * - Trims whitespace
 * - Prevents prototype pollution
 */

const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '');
}

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return stripHtml(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  const clean = {};
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      continue; // silently drop dangerous keys
    }
    clean[key] = sanitizeValue(obj[key]);
  }
  return clean;
}

function sanitize(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

module.exports = sanitize;
