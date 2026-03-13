/**
 * Broadcast a new sale to all clients in the business room.
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {string} businessId - Business UUID (used as room name)
 * @param {object} saleData - Sale record with items and payments
 */
function broadcastSale(io, businessId, saleData) {
  io.to(`business:${businessId}`).emit('new-sale', {
    type: 'new-sale',
    businessId,
    data: saleData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast a stock update to all clients in the business room.
 * @param {import('socket.io').Server} io - Socket.IO server instance
 * @param {string} businessId - Business UUID (used as room name)
 * @param {object} product - Updated product record
 */
function broadcastStockUpdate(io, businessId, product) {
  io.to(`business:${businessId}`).emit('stock-update', {
    type: 'stock-update',
    businessId,
    data: {
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      low_stock_threshold: product.low_stock_threshold,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Initialize WebSocket event handlers.
 * Clients join their business room on connection.
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
function initializeWebSocket(io) {
  io.on('connection', (socket) => {
    const { businessId } = socket.handshake.query;

    if (businessId) {
      socket.join(businessId);
      console.log(`[WS] Client joined room: ${businessId}`);
    }

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected from room: ${businessId}`);
    });
  });
}

module.exports = {
  broadcastSale,
  broadcastStockUpdate,
  initializeWebSocket,
};
