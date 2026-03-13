const db = require('../config/database');

/**
 * Get a business by ID.
 * @param {string} businessId - Business UUID
 * @returns {Promise<object|null>}
 */
async function getById(businessId) {
  return db('businesses').where({ id: businessId }).first();
}

/**
 * Update a business record.
 * @param {string} businessId - Business UUID
 * @param {object} data - { name?, type?, currency?, logoUrl? }
 * @returns {Promise<object>}
 */
async function update(businessId, data) {
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.type !== undefined) updates.type = data.type;
  if (data.currency !== undefined) updates.currency = data.currency;
  if (data.logoUrl !== undefined || data.logo_url !== undefined)
    updates.logo_url = data.logoUrl || data.logo_url;
  updates.updated_at = db.fn.now();

  const [business] = await db('businesses')
    .where({ id: businessId })
    .update(updates)
    .returning('*');

  if (!business) {
    const error = new Error('Business not found');
    error.status = 404;
    throw error;
  }

  return business;
}

/**
 * Complete onboarding: set up initial data (products, bank accounts, etc.).
 * @param {string} businessId - Business UUID
 * @param {object} body - { products?: object[], bankAccounts?: object[], cashBalance?: number }
 * @returns {Promise<{ message: string }>}
 */
async function completeOnboarding(businessId, body) {
  const { products = [], bankAccounts = [], cashBalance = 0 } = body;

  await db.transaction(async (trx) => {
    // Import initial products
    if (products.length > 0) {
      await trx('products').insert(
        products.map((p) => ({
          business_id: businessId,
          name: p.name,
          barcode: p.barcode || null,
          category: p.category || null,
          unit: p.unit || 'pcs',
          buy_price: p.buyPrice || p.buy_price || 0,
          sell_price: p.sellPrice || p.sell_price || 0,
          quantity: p.quantity || 0,
          low_stock_threshold: p.lowStockThreshold || p.low_stock_threshold || 10,
        }))
      );
    }

    // Set up bank accounts
    if (bankAccounts.length > 0) {
      await trx('bank_accounts').insert(
        bankAccounts.map((a) => ({
          business_id: businessId,
          bank_name: a.bankName || a.bank_name,
          account_name: a.accountName || a.account_name || null,
          account_number: a.accountNumber || a.account_number || null,
          balance: parseFloat(a.balance || 0),
        }))
      );
    }

    // Set initial cash balance
    if (cashBalance > 0) {
      await trx('cash_transactions').insert({
        business_id: businessId,
        type: 'add',
        amount: parseFloat(cashBalance),
        description: 'Initial cash balance',
        balance_after: parseFloat(cashBalance),
      });
    }
  });

  return { message: 'Onboarding complete' };
}

/**
 * Get settings for a business.
 * @param {string} businessId - Business UUID
 * @returns {Promise<object>}
 */
async function getSettings(businessId) {
  let settings = await db('settings')
    .where({ business_id: businessId })
    .first();

  if (!settings) {
    // Create default settings
    const [created] = await db('settings')
      .insert({ business_id: businessId })
      .returning('*');
    settings = created;
  }

  return settings;
}

/**
 * Update settings for a business.
 * @param {string} businessId - Business UUID
 * @param {object} data - Settings fields to update
 * @returns {Promise<object>}
 */
async function updateSettings(businessId, data) {
  const allowedFields = [
    'theme', 'language', 'sound_enabled', 'haptic_enabled',
    'auto_process_bank', 'low_stock_threshold_default', 'data_saver_mode',
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) updates[field] = data[field];
  }
  // Handle camelCase from client
  if (data.soundEnabled !== undefined) updates.sound_enabled = data.soundEnabled;
  if (data.hapticEnabled !== undefined) updates.haptic_enabled = data.hapticEnabled;
  if (data.autoProcessBank !== undefined) updates.auto_process_bank = data.autoProcessBank;
  if (data.lowStockThresholdDefault !== undefined) updates.low_stock_threshold_default = data.lowStockThresholdDefault;
  if (data.dataSaverMode !== undefined) updates.data_saver_mode = data.dataSaverMode;
  updates.updated_at = db.fn.now();

  const [settings] = await db('settings')
    .where({ business_id: businessId })
    .update(updates)
    .returning('*');

  return settings;
}

module.exports = {
  getById,
  update,
  completeOnboarding,
  getSettings,
  updateSettings,
};
