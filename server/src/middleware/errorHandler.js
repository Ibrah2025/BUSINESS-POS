const logger = require('./logger');

function errorHandler(err, req, res, next) {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({
    error: { message, ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) }
  });
}

module.exports = errorHandler;
