const db = require('../config/database');

/**
 * List expenses with optional category and date filters.
 * @param {string} businessId - Business UUID
 * @param {object} query - { category, month, year, page, limit }
 * @returns {Promise<{ expenses: object[], total: number }>}
 */
async function list(businessId, query = {}) {
  const { category, month, year, page = 1, limit = 50 } = query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  let builder = db('expenses').where({ business_id: businessId });

  if (category) {
    builder = builder.andWhere({ category });
  }
  if (month && year) {
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    builder = builder.whereBetween('date', [startDate, endDate]);
  }

  const [{ count }] = await builder.clone().count('* as count');
  const expenses = await builder
    .orderBy('date', 'desc')
    .limit(parseInt(limit))
    .offset(offset);

  return { expenses, total: parseInt(count) };
}

/**
 * Create a new expense and deduct from cash or bank balance.
 * @param {string} businessId - Business UUID
 * @param {string} userId - User who created the expense
 * @param {object} data - { category, description?, amount, paymentMethod, bankAccountId?, date, isRecurring?, recurrenceInterval? }
 * @returns {Promise<object>}
 */
async function create(businessId, userId, data) {
  return db.transaction(async (trx) => {
    const [expense] = await trx('expenses')
      .insert({
        business_id: businessId,
        category: data.category,
        description: data.description || null,
        amount: parseFloat(data.amount),
        payment_method: data.paymentMethod || data.payment_method,
        bank_account_id: data.bankAccountId || data.bank_account_id || null,
        date: data.date || new Date(),
        is_recurring: data.isRecurring || false,
        recurrence_interval: data.recurrenceInterval || null,
      })
      .returning('*');

    const method = data.paymentMethod || data.payment_method;

    // Deduct from cash
    if (method === 'cash') {
      const lastCashTx = await trx('cash_transactions')
        .where({ business_id: businessId })
        .orderBy('created_at', 'desc')
        .first();
      const currentBalance = lastCashTx
        ? parseFloat(lastCashTx.balance_after)
        : 0;
      const newBalance = Math.max(0, currentBalance - parseFloat(data.amount));

      await trx('cash_transactions').insert({
        business_id: businessId,
        type: 'expense',
        amount: -parseFloat(data.amount),
        description: `Expense: ${data.category}${data.description ? ' - ' + data.description : ''}`,
        balance_after: newBalance,
      });
    }

    // Deduct from bank
    const bankId = data.bankAccountId || data.bank_account_id;
    if (method === 'bank' && bankId) {
      await trx('bank_accounts')
        .where({ id: bankId, business_id: businessId })
        .decrement('balance', parseFloat(data.amount))
        .update({ updated_at: trx.fn.now() });

      await trx('bank_transactions').insert({
        bank_account_id: bankId,
        business_id: businessId,
        type: 'expense',
        amount: -parseFloat(data.amount),
        reference_id: expense.id,
        description: `Expense: ${data.category}`,
      });
    }

    return expense;
  });
}

/**
 * Update an expense record.
 * @param {string} businessId - Business UUID
 * @param {string} id - Expense UUID
 * @param {object} data - Fields to update
 * @returns {Promise<object>}
 */
async function update(businessId, id, data) {
  const allowedFields = ['category', 'description', 'amount', 'date', 'is_recurring', 'recurrence_interval'];
  const updates = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) updates[field] = data[field];
  }
  // Handle camelCase
  if (data.isRecurring !== undefined) updates.is_recurring = data.isRecurring;
  if (data.recurrenceInterval !== undefined) updates.recurrence_interval = data.recurrenceInterval;

  const [expense] = await db('expenses')
    .where({ id, business_id: businessId })
    .update(updates)
    .returning('*');

  if (!expense) {
    const error = new Error('Expense not found');
    error.status = 404;
    throw error;
  }

  return expense;
}

/**
 * Delete an expense.
 * @param {string} businessId - Business UUID
 * @param {string} id - Expense UUID
 * @returns {Promise<void>}
 */
async function deleteExpense(businessId, id) {
  const count = await db('expenses')
    .where({ id, business_id: businessId })
    .del();

  if (count === 0) {
    const error = new Error('Expense not found');
    error.status = 404;
    throw error;
  }
}

/**
 * Get expense summary grouped by category for a given month.
 * @param {string} businessId - Business UUID
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<{ categories: object[], total: number }>}
 */
async function getSummary(businessId, month, year) {
  const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
  const endDate = new Date(parseInt(year), parseInt(month), 0);

  const categories = await db('expenses')
    .where({ business_id: businessId })
    .whereBetween('date', [startDate, endDate])
    .select('category')
    .sum('amount as total')
    .groupBy('category')
    .orderBy('total', 'desc');

  const total = categories.reduce((sum, c) => sum + parseFloat(c.total), 0);

  return { categories, total };
}

module.exports = {
  list,
  create,
  update,
  delete: deleteExpense,
  getSummary,
};
