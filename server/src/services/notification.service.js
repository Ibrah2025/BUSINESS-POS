const db = require('../config/database');

/**
 * Notify about a sale via enabled notification channels.
 * Checks business notification_prefs and dispatches accordingly.
 * @param {string} businessId - Business UUID
 * @param {object} saleData - Sale record with items and payments
 * @returns {Promise<void>}
 */
async function notifySale(businessId, saleData) {
  const business = await db('businesses')
    .where({ id: businessId })
    .first();

  if (!business) return;

  const prefs = typeof business.notification_prefs === 'string'
    ? JSON.parse(business.notification_prefs)
    : business.notification_prefs || {};

  const message = formatSaleMessage(saleData, business);

  const dispatches = [];

  if (prefs.whatsapp?.enabled && prefs.whatsapp?.phone) {
    dispatches.push(
      sendWhatsApp(prefs.whatsapp.phone, message)
        .then(() => logNotification(businessId, 'whatsapp', message, 'sent'))
        .catch((err) => logNotification(businessId, 'whatsapp', message, 'failed'))
    );
  }

  if (prefs.telegram?.enabled && prefs.telegram?.chatId) {
    dispatches.push(
      sendTelegram(prefs.telegram.chatId, message)
        .then(() => logNotification(businessId, 'telegram', message, 'sent'))
        .catch((err) => logNotification(businessId, 'telegram', message, 'failed'))
    );
  }

  if (prefs.sms?.enabled && prefs.sms?.phone) {
    dispatches.push(
      sendSMS(prefs.sms.phone, message)
        .then(() => logNotification(businessId, 'sms', message, 'sent'))
        .catch((err) => logNotification(businessId, 'sms', message, 'failed'))
    );
  }

  await Promise.allSettled(dispatches);
}

/**
 * Format a sale into a readable notification message.
 * @param {object} saleData - Sale record
 * @param {object} business - Business record
 * @returns {string}
 */
function formatSaleMessage(saleData, business) {
  const currency = business.currency || '₦';
  const itemCount = saleData.items ? saleData.items.length : 0;
  return `New sale: ${currency}${parseFloat(saleData.total_amount).toLocaleString()} (${itemCount} items) | Profit: ${currency}${parseFloat(saleData.profit || 0).toLocaleString()}`;
}

/**
 * Send a WhatsApp message.
 * @param {string} phone - Phone number
 * @param {string} message - Message text
 * @returns {Promise<void>}
 */
async function sendWhatsApp(phone, message) {
  // TODO: Integrate with WhatsApp Business API or third-party service
  // e.g., Twilio, WATI, or direct WhatsApp Cloud API
  console.log(`[WhatsApp] To: ${phone} | ${message}`);
}

/**
 * Send a Telegram message.
 * @param {string} chatId - Telegram chat ID
 * @param {string} message - Message text
 * @returns {Promise<void>}
 */
async function sendTelegram(chatId, message) {
  // TODO: Use Telegram Bot API
  // const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  // await fetch(url, { method: 'POST', body: JSON.stringify({ chat_id: chatId, text: message }) });
  console.log(`[Telegram] To: ${chatId} | ${message}`);
}

/**
 * Send an SMS message.
 * @param {string} phone - Phone number
 * @param {string} message - Message text
 * @returns {Promise<void>}
 */
async function sendSMS(phone, message) {
  // TODO: Integrate with SMS provider (Twilio, Termii, Africa's Talking, etc.)
  console.log(`[SMS] To: ${phone} | ${message}`);
}

/**
 * Log a notification attempt.
 * @param {string} businessId - Business UUID
 * @param {string} channel - 'whatsapp'|'telegram'|'sms'
 * @param {string} message - Message content
 * @param {string} status - 'sent'|'failed'
 * @returns {Promise<void>}
 */
async function logNotification(businessId, channel, message, status) {
  await db('notifications_log').insert({
    business_id: businessId,
    channel,
    message,
    status,
  });
}

/**
 * Get notification preferences for a business.
 * @param {string} businessId - Business UUID
 * @returns {Promise<object>}
 */
async function getPreferences(businessId) {
  const business = await db('businesses')
    .where({ id: businessId })
    .select('notification_prefs')
    .first();

  if (!business) {
    const error = new Error('Business not found');
    error.status = 404;
    throw error;
  }

  const prefs = typeof business.notification_prefs === 'string'
    ? JSON.parse(business.notification_prefs)
    : business.notification_prefs || {};

  return prefs;
}

/**
 * Update notification preferences for a business.
 * @param {string} businessId - Business UUID
 * @param {object} prefs - { whatsapp?: { enabled, phone }, telegram?: { enabled, chatId }, sms?: { enabled, phone } }
 * @returns {Promise<object>} Updated preferences
 */
async function updatePreferences(businessId, prefs) {
  const [business] = await db('businesses')
    .where({ id: businessId })
    .update({
      notification_prefs: JSON.stringify(prefs),
      updated_at: db.fn.now(),
    })
    .returning('notification_prefs');

  const result = typeof business.notification_prefs === 'string'
    ? JSON.parse(business.notification_prefs)
    : business.notification_prefs;

  return result;
}

/**
 * Send a test notification to verify channel configuration.
 * @param {string} businessId - Business UUID
 * @param {object} body - { channel: 'whatsapp'|'telegram'|'sms' }
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function sendTest(businessId, body) {
  const prefs = await getPreferences(businessId);
  const { channel } = body;
  const testMessage = 'Test notification from your POS system.';

  try {
    if (channel === 'whatsapp' && prefs.whatsapp?.phone) {
      await sendWhatsApp(prefs.whatsapp.phone, testMessage);
    } else if (channel === 'telegram' && prefs.telegram?.chatId) {
      await sendTelegram(prefs.telegram.chatId, testMessage);
    } else if (channel === 'sms' && prefs.sms?.phone) {
      await sendSMS(prefs.sms.phone, testMessage);
    } else {
      return { success: false, message: `Channel "${channel}" not configured` };
    }

    await logNotification(businessId, channel, testMessage, 'sent');
    return { success: true, message: `Test ${channel} notification sent` };
  } catch (err) {
    await logNotification(businessId, channel, testMessage, 'failed');
    return { success: false, message: err.message };
  }
}

/**
 * Get notification log for a business.
 * @param {string} businessId - Business UUID
 * @param {object} query - { page, limit }
 * @returns {Promise<{ logs: object[], total: number }>}
 */
async function getLog(businessId, query = {}) {
  const { page = 1, limit = 50 } = query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  const builder = db('notifications_log').where({ business_id: businessId });
  const [{ count }] = await builder.clone().count('* as count');
  const logs = await builder
    .orderBy('created_at', 'desc')
    .limit(parseInt(limit))
    .offset(offset);

  return { logs, total: parseInt(count) };
}

module.exports = {
  notifySale,
  sendWhatsApp,
  sendTelegram,
  sendSMS,
  getPreferences,
  updatePreferences,
  sendTest,
  getLog,
};
