const db = require('../config/database');

/**
 * Get the current cash balance and recent transactions.
 * @param {string} businessId - Business UUID
 * @returns {Promise<{ balance: number, transactions: object[] }>}
 */
async function getBalance(businessId) {
  const lastTx = await db('cash_transactions')
    .where({ business_id: businessId })
    .orderBy('created_at', 'desc')
    .first();

  const balance = lastTx ? parseFloat(lastTx.balance_after) : 0;

  const transactions = await db('cash_transactions')
    .where({ business_id: businessId })
    .orderBy('created_at', 'desc')
    .limit(50);

  return { balance, transactions };
}

/**
 * Add a cash transaction (add or remove cash).
 * @param {string} businessId - Business UUID
 * @param {string} userId - User who performed the action
 * @param {object} body - { type: 'add'|'remove', amount, description? }
 * @returns {Promise<object>} Created transaction with new balance
 */
async function addTransaction(businessId, userId, body) {
  const { type, amount, description } = body;

  const lastTx = await db('cash_transactions')
    .where({ business_id: businessId })
    .orderBy('created_at', 'desc')
    .first();

  const currentBalance = lastTx ? parseFloat(lastTx.balance_after) : 0;
  const parsedAmount = parseFloat(amount);

  let newBalance;
  let txAmount;

  if (type === 'add') {
    newBalance = currentBalance + parsedAmount;
    txAmount = parsedAmount;
  } else if (type === 'remove') {
    newBalance = Math.max(0, currentBalance - parsedAmount);
    txAmount = -parsedAmount;
  } else {
    const error = new Error('Invalid transaction type. Use "add" or "remove".');
    error.status = 400;
    throw error;
  }

  const [transaction] = await db('cash_transactions')
    .insert({
      business_id: businessId,
      type,
      amount: txAmount,
      description: description || null,
      balance_after: newBalance,
    })
    .returning('*');

  return { ...transaction, balance: newBalance };
}

/**
 * Get reconciliation data: compare expected vs actual cash.
 * @param {string} businessId - Business UUID
 * @param {object} query - { date? }
 * @returns {Promise<object>} Reconciliation summary
 */
async function getReconciliation(businessId, query = {}) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const dateFilter = query.date ? new Date(query.date) : todayStart;

  const transactions = await db('cash_transactions')
    .where({ business_id: businessId })
    .where('created_at', '>=', dateFilter)
    .orderBy('created_at', 'asc');

  const totalIn = transactions
    .filter((t) => parseFloat(t.amount) > 0)
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalOut = transactions
    .filter((t) => parseFloat(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

  const lastTx = await db('cash_transactions')
    .where({ business_id: businessId })
    .orderBy('created_at', 'desc')
    .first();

  return {
    currentBalance: lastTx ? parseFloat(lastTx.balance_after) : 0,
    totalIn,
    totalOut,
    netChange: totalIn - totalOut,
    transactionCount: transactions.length,
  };
}

module.exports = {
  getBalance,
  addTransaction,
  getReconciliation,
};
