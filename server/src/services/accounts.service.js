const db = require('../config/database');

function mapAccountFields(a) {
  return {
    ...a,
    bankName: a.bank_name,
    accountName: a.account_name,
    accountNumber: a.account_number,
    accountType: a.account_type,
  };
}

/**
 * List all bank accounts for a business.
 * @param {string} businessId - Business UUID
 * @returns {Promise<object[]>}
 */
async function list(businessId) {
  const rows = await db('bank_accounts')
    .where({ business_id: businessId, is_active: true })
    .orderBy('usage_count', 'desc');
  return rows.map(mapAccountFields);
}

/**
 * Create a new bank account.
 * @param {string} businessId - Business UUID
 * @param {object} data - { bankName, accountName?, accountNumber?, accountType?, balance? }
 * @returns {Promise<object>}
 */
async function create(businessId, data) {
  const [account] = await db('bank_accounts')
    .insert({
      business_id: businessId,
      bank_name: data.bankName || data.bank_name,
      account_name: data.accountName || data.account_name || null,
      account_number: data.accountNumber || data.account_number || null,
      account_type: data.accountType || data.account_type || 'bank',
      balance: parseFloat(data.balance || 0),
    })
    .returning('*');

  return mapAccountFields(account);
}

/**
 * Update a bank account.
 * @param {string} businessId - Business UUID
 * @param {string} id - Account UUID
 * @param {object} data - Fields to update
 * @returns {Promise<object>}
 */
async function update(businessId, id, data) {
  const updates = {};
  if (data.bankName !== undefined || data.bank_name !== undefined)
    updates.bank_name = data.bankName || data.bank_name;
  if (data.accountName !== undefined || data.account_name !== undefined)
    updates.account_name = data.accountName || data.account_name;
  if (data.accountNumber !== undefined || data.account_number !== undefined)
    updates.account_number = data.accountNumber || data.account_number;
  if (data.balance !== undefined)
    updates.balance = parseFloat(data.balance);
  updates.updated_at = db.fn.now();

  const [account] = await db('bank_accounts')
    .where({ id, business_id: businessId })
    .update(updates)
    .returning('*');

  if (!account) {
    const error = new Error('Account not found');
    error.status = 404;
    throw error;
  }

  return mapAccountFields(account);
}

/**
 * Soft-delete a bank account.
 * @param {string} businessId - Business UUID
 * @param {string} id - Account UUID
 * @returns {Promise<void>}
 */
async function deleteAccount(businessId, id) {
  const count = await db('bank_accounts')
    .where({ id, business_id: businessId })
    .update({ is_active: false, updated_at: db.fn.now() });

  if (count === 0) {
    const error = new Error('Account not found');
    error.status = 404;
    throw error;
  }
}

/**
 * Get transaction history for a specific bank account.
 * @param {string} businessId - Business UUID
 * @param {string} accountId - Bank account UUID
 * @param {object} query - { page, limit }
 * @returns {Promise<{ transactions: object[], total: number }>}
 */
async function getTransactions(businessId, accountId, query = {}) {
  const { page = 1, limit = 50 } = query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  const builder = db('bank_transactions')
    .where({ bank_account_id: accountId, business_id: businessId });

  const [{ count }] = await builder.clone().count('* as count');
  const transactions = await builder
    .orderBy('created_at', 'desc')
    .limit(parseInt(limit))
    .offset(offset);

  return { transactions, total: parseInt(count) };
}

module.exports = {
  list,
  create,
  update,
  delete: deleteAccount,
  getTransactions,
};
