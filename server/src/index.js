const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Server } = require('socket.io');
const env = require('./config/env');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
app.set('trust proxy', 1); // Render uses a reverse proxy
const server = http.createServer(app);

// WebSocket
const io = new Server(server, {
  cors: { origin: [env.clientUrl, 'https://localhost', 'capacitor://localhost', 'http://localhost'], credentials: true }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(cors({
  origin: [
    env.clientUrl,
    'https://localhost',
    'capacitor://localhost',
    'http://localhost',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(require('./middleware/sanitize'));
app.use(require('./middleware/auditLog'));
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/business', require('./routes/business.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/sales', require('./routes/sales.routes'));
app.use('/api/returns', require('./routes/returns.routes'));
app.use('/api/credits', require('./routes/credits.routes'));
app.use('/api/expenses', require('./routes/expenses.routes'));
app.use('/api/accounts', require('./routes/accounts.routes'));
app.use('/api/cash', require('./routes/cash.routes'));
app.use('/api/customers', require('./routes/customers.routes'));
app.use('/api/export', require('./routes/export.routes'));
app.use('/api/sync', require('./routes/sync.routes'));
app.use('/api/actions', require('./routes/actions.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/subscription', require('./routes/subscription.routes'));
app.use('/api/whatsapp', require('./routes/whatsapp.routes'));

// Serve React client (built by Vite) in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  // Let API 404s pass to error handler, serve index.html for everything else (SPA)
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Error handler
app.use(errorHandler);

// WebSocket connections
io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);

  socket.on('join-business', (businessId) => {
    socket.join(`business:${businessId}`);
    logger.debug(`Socket ${socket.id} joined business:${businessId}`);
  });

  socket.on('disconnect', () => {
    logger.debug(`WebSocket client disconnected: ${socket.id}`);
  });
});

server.listen(env.port, () => {
  logger.info(`Server running on port ${env.port} [${env.nodeEnv}]`);

  // Start Telegram bot — only in production (Render) to avoid polling conflicts with local dev
  const telegramBot = require('./services/telegram.service');
  if (env.nodeEnv === 'production') {
    telegramBot.init(process.env.TELEGRAM_BOT_TOKEN);
  } else {
    console.log('ℹ️  Telegram bot skipped in dev mode (set NODE_ENV=production to enable)');
  }

  // WhatsApp (Baileys) — only auto-start in development (cloud IPs are blocked by WhatsApp)
  // On production, WhatsApp connects on-demand when user taps "Connect" in Settings
  const whatsappService = require('./services/whatsapp.service');
  if (env.nodeEnv !== 'production' && process.env.WHATSAPP_ENABLED === 'true') {
    whatsappService.init(true);
  } else {
    console.log('📱 WhatsApp available on-demand (connect from app Settings)');
  }
});

module.exports = { app, server, io };
