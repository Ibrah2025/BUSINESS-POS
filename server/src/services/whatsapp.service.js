/**
 * WhatsApp Service for BizPOS (using Baileys)
 * Sends sale notifications via WhatsApp Web protocol.
 *
 * Auth state is stored in PostgreSQL so it survives Render restarts.
 */

const db = require('../config/database');
const QRCode = require('qrcode');
const {
  makeWASocket,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  initAuthCreds,
  proto,
  BufferJSON,
} = require('@whiskeysockets/baileys');
const pino = require('pino');

let sock = null;
let currentQR = null;       // base64 data-URL of latest QR code
let connectionState = 'disconnected'; // disconnected | connecting | qr | connected
let connectRetries = 0;
const MAX_RETRIES = 5;

const fmt = (n) => '\u20A6' + (Number(n) || 0).toLocaleString('en-NG');
const logger = pino({ level: 'silent' });

// ─── Database-backed Auth State for Baileys ────────────────────────────────

async function useDBAuthState() {
  const writeData = async (key, data) => {
    const json = JSON.stringify(data, BufferJSON.replacer);
    await db.raw(
      `INSERT INTO whatsapp_auth_state (key, value, updated_at)
       VALUES (?, ?::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, json]
    );
  };

  const readData = async (key) => {
    const row = await db('whatsapp_auth_state').where({ key }).first();
    if (!row) return null;
    const raw = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
    return JSON.parse(raw, BufferJSON.reviver);
  };

  const removeData = async (key) => {
    await db('whatsapp_auth_state').where({ key }).del();
  };

  // Load existing creds or create fresh ones
  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const result = {};
          for (const id of ids) {
            const val = await readData(`${type}-${id}`);
            if (val) result[id] = val;
          }
          return result;
        },
        set: async (data) => {
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) {
              if (value) {
                await writeData(`${type}-${id}`, value);
              } else {
                await removeData(`${type}-${id}`);
              }
            }
          }
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    },
  };
}

// ─── Connection ────────────────────────────────────────────────────────────

async function connect() {
  if (sock) return;
  connectionState = 'connecting';
  console.log('📱 WhatsApp connecting... (attempt ' + (connectRetries + 1) + ')');

  try {
    const { state, saveCreds } = await useDBAuthState();

    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      browser: ['BizPOS', 'Chrome', '4.0.0'],
      connectTimeoutMs: 60000,
    });

    // Save credentials whenever they update
    sock.ev.on('creds.update', saveCreds);

    // Connection updates (QR code, connected, disconnected)
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Generate QR as base64 data URL for the web app
        currentQR = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        connectionState = 'qr';
        console.log('📱 WhatsApp QR code ready — scan from app Settings or server logs');
      }

      if (connection === 'close') {
        sock = null;
        currentQR = null;
        connectionState = 'disconnected';
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut || statusCode === 405) {
          // 401 = logged out, 405 = rejected/stale credentials — clear and start fresh
          console.log(`📱 WhatsApp auth rejected (code ${statusCode}) — clearing auth state`);
          await db('whatsapp_auth_state').del();
          connectRetries = 0;
          // Reconnect fresh (will show QR code)
          setTimeout(() => connect(), 3000);
        } else if (connectRetries < MAX_RETRIES) {
          connectRetries++;
          console.log(`📱 WhatsApp disconnected (code ${statusCode}) — retry ${connectRetries}/${MAX_RETRIES}`);
          setTimeout(() => connect(), 5000);
        } else {
          console.log(`📱 WhatsApp gave up after ${MAX_RETRIES} retries (last code ${statusCode})`);
        }
      }

      if (connection === 'open') {
        currentQR = null;
        connectionState = 'connected';
        connectRetries = 0;
        console.log('📱 WhatsApp connected successfully');
      }
    });
  } catch (err) {
    console.error('📱 WhatsApp connection error:', err.message);
    sock = null;
    connectionState = 'disconnected';
    // Retry after 30s
    setTimeout(() => connect(), 30000);
  }
}

// ─── Disconnect / Logout ───────────────────────────────────────────────────

async function disconnect() {
  if (sock) {
    await sock.logout().catch(() => {});
    sock = null;
  }
  currentQR = null;
  connectionState = 'disconnected';
  await db('whatsapp_auth_state').del();
}

// ─── Send Message ──────────────────────────────────────────────────────────

/**
 * Send a WhatsApp text message.
 * @param {string} phone - Phone number with country code, e.g. "2348012345678"
 * @param {string} text - Message text
 */
async function sendMessage(phone, text) {
  if (!sock || connectionState !== 'connected') {
    console.log('📱 WhatsApp not connected — message not sent');
    return false;
  }

  // Format JID: remove leading + or 0, ensure country code
  let cleanPhone = phone.replace(/[\s\-\+]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '234' + cleanPhone.slice(1); // Nigerian number
  }
  const jid = `${cleanPhone}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    console.error('📱 WhatsApp send error:', err.message);
    return false;
  }
}

// ─── Sale Notification ─────────────────────────────────────────────────────

async function notifySale(businessId, saleData) {
  if (!sock || connectionState !== 'connected') return;

  try {
    // Get WhatsApp config for this business
    const config = await db('whatsapp_config')
      .where({ business_id: businessId, is_active: true })
      .first();

    if (!config || !config.recipient_phone || !config.notify_sales) return;

    // Get business language
    const settings = await db('settings').where({ business_id: businessId }).first();
    const lang = settings?.language === 'ha' ? 'ha' : 'en';

    const items = (saleData.items || []).map((i) => {
      const name = i.product_name || i.productName || i.name || '?';
      const qty = parseInt(i.quantity) || 0;
      const price = i.unit_price || i.unitPrice || 0;
      return `  ${name} x${qty}  =  ${fmt(price * qty)}`;
    }).join('\n');

    const method = saleData.payments?.[0]?.method || 'cash';
    const methodLabel = {
      cash: lang === 'ha' ? 'Tsabar Kudi' : 'Cash',
      bank: lang === 'ha' ? 'Banki' : 'Bank',
      credit: lang === 'ha' ? 'Bashi' : 'Credit',
    }[method] || method;

    // Format time
    const saleTime = new Date(saleData.created_at || Date.now());
    const timeStr = saleTime.toLocaleString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    // Get attendant name
    let attendantLine = '';
    if (saleData.attendant_id) {
      try {
        const attendant = await db('users')
          .where({ id: saleData.attendant_id })
          .select('name')
          .first();
        if (attendant?.name) {
          attendantLine = `\n${lang === 'ha' ? 'Mai sayarwa' : 'Sold by'}: ${attendant.name}`;
        }
      } catch {}
    }

    const text =
      `*${lang === 'ha' ? 'Sabon Saye!' : 'New Sale!'}*\n` +
      `${timeStr}\n` +
      `-------------------\n` +
      `${items}\n` +
      `-------------------\n` +
      `*${lang === 'ha' ? 'Jimla' : 'Total'}:* ${fmt(saleData.total_amount || saleData.totalAmount)}\n` +
      `*${lang === 'ha' ? 'Riba' : 'Profit'}:* ${fmt(saleData.profit)}\n` +
      `${methodLabel}` +
      attendantLine;

    await sendMessage(config.recipient_phone, text);
  } catch (err) {
    console.error('📱 WhatsApp sale notification error:', err.message);
  }
}

// ─── Config Management ─────────────────────────────────────────────────────

async function setConfig(businessId, recipientPhone) {
  // Normalize phone number
  let phone = recipientPhone.replace(/[\s\-\+]/g, '');
  if (phone.startsWith('0')) {
    phone = '234' + phone.slice(1);
  }

  const existing = await db('whatsapp_config').where({ business_id: businessId }).first();
  if (existing) {
    await db('whatsapp_config')
      .where({ business_id: businessId })
      .update({ recipient_phone: phone, is_active: true, updated_at: db.fn.now() });
  } else {
    await db('whatsapp_config').insert({
      business_id: businessId,
      recipient_phone: phone,
      notify_sales: true,
      is_active: true,
    });
  }
  return { phone, status: 'configured' };
}

async function getConfig(businessId) {
  return db('whatsapp_config').where({ business_id: businessId }).first();
}

// ─── Status ────────────────────────────────────────────────────────────────

function getStatus() {
  return {
    state: connectionState,
    qrCode: currentQR, // base64 data URL or null
    connected: connectionState === 'connected',
  };
}

// ─── Init ──────────────────────────────────────────────────────────────────

function init(enabled) {
  if (!enabled) {
    console.log('ℹ️  WhatsApp integration disabled (WHATSAPP_ENABLED not set)');
    return;
  }
  console.log('📱 Starting WhatsApp connection...');
  connect();
}

function resetRetries() {
  connectRetries = 0;
}

module.exports = {
  init,
  connect,
  disconnect,
  sendMessage,
  notifySale,
  setConfig,
  getConfig,
  getStatus,
  resetRetries,
};
