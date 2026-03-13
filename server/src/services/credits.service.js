const db = require('../config/database');

function mapCredit(r) {
  return {
    id: r.id,
    businessId: r.business_id,
    customerId: r.customer_id,
    type: r.type,
    name: r.name,
    phone: r.phone,
    amount: parseFloat(r.total_amount) || 0,
    balance: parseFloat(r.balance_remaining) || 0,
    balanceRemaining: parseFloat(r.balance_remaining) || 0,
    dueDate: r.due_date,
    status: r.status,
    description: r.items_description,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * List credits filtered by type and status.
 * @param {string} businessId - Business UUID
 * @param {object} query - { type: 'customer'|'supplier', status, page, limit }
 * @returns {Promise<{ credits: object[], total: number }>}
 */
async function list(businessId, query = {}) {
  const { type, status, page = 1, limit = 50 } = query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  let builder = db('credits').where({ business_id: businessId });

  if (type) builder = builder.andWhere({ type });
  if (status) builder = builder.andWhere({ status });

  const [{ count }] = await builder.clone().count('* as count');
  const rows = await builder
    .orderBy('created_at', 'desc')
    .limit(parseInt(limit))
    .offset(offset);

  // Fetch payments for all credits in one query
  const creditIds = rows.map((r) => r.id);
  const payments = creditIds.length > 0
    ? await db('credit_payments')
        .whereIn('credit_id', creditIds)
        .orderBy('paid_at', 'desc')
    : [];

  // Group payments by credit_id
  const paymentMap = {};
  for (const p of payments) {
    if (!paymentMap[p.credit_id]) paymentMap[p.credit_id] = [];
    paymentMap[p.credit_id].push({
      id: p.id,
      amount: parseFloat(p.amount) || 0,
      method: p.method,
      bankAccountId: p.bank_account_id,
      date: p.created_at,
    });
  }

  const credits = rows.map((r) => ({
    ...mapCredit(r),
    payments: paymentMap[r.id] || [],
  }));

  return { credits, total: parseInt(count) };
}

/**
 * Create a new credit record.
 * @param {string} businessId - Business UUID
 * @param {object} data - { type, name, phone?, customerId?, totalAmount, dueDate?, itemsDescription? }
 * @returns {Promise<object>}
 */
async function create(businessId, data) {
  const amount = parseFloat(data.totalAmount || data.amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Valid amount is required');
  }

  const [credit] = await db('credits')
    .insert({
      business_id: businessId,
      customer_id: data.customerId || null,
      type: data.type,
      name: data.name,
      phone: data.phone || null,
      total_amount: amount,
      balance_remaining: amount,
      due_date: data.dueDate || null,
      status: 'pending',
      items_description: data.itemsDescription || data.description || null,
    })
    .returning('*');

  return mapCredit(credit);
}

/**
 * Update a credit record.
 * @param {string} businessId - Business UUID
 * @param {string} id - Credit UUID
 * @param {object} data - Fields to update
 * @returns {Promise<object>}
 */
async function update(businessId, id, data) {
  const allowedFields = ['name', 'phone', 'due_date', 'items_description'];
  const updates = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) updates[field] = data[field];
  }
  // Handle camelCase from client
  if (data.dueDate !== undefined) updates.due_date = data.dueDate;
  if (data.itemsDescription !== undefined) updates.items_description = data.itemsDescription;
  updates.updated_at = db.fn.now();

  const [credit] = await db('credits')
    .where({ id, business_id: businessId })
    .update(updates)
    .returning('*');

  if (!credit) {
    const error = new Error('Credit not found');
    error.status = 404;
    throw error;
  }

  return mapCredit(credit);
}

/**
 * Record a payment against a credit.
 * Supports single payment { amount, method, bankAccountId } or
 * split payments { payments: [{ amount, method, bankAccountId }] }.
 * Updates balance_remaining and status. Adds to cash or bank balance.
 */
async function recordPayment(businessId, creditId, body) {
  // Support both single and split payment formats
  const paymentParts = body.payments || [
    { amount: body.amount, method: body.method, bankAccountId: body.bankAccountId },
  ];

  return db.transaction(async (trx) => {
    const credit = await trx('credits')
      .where({ id: creditId, business_id: businessId })
      .first();

    if (!credit) {
      const error = new Error('Credit not found');
      error.status = 404;
      throw error;
    }

    let remainingBalance = parseFloat(credit.balance_remaining);
    const createdPayments = [];

    for (const part of paymentParts) {
      const partAmount = Math.min(parseFloat(part.amount), remainingBalance);
      if (partAmount <= 0) continue;

      // Create payment record
      const [payment] = await trx('credit_payments')
        .insert({
          credit_id: creditId,
          amount: partAmount,
          method: part.method,
          bank_account_id: part.bankAccountId || null,
        })
        .returning('*');

      createdPayments.push({
        id: payment.id,
        amount: parseFloat(payment.amount),
        method: payment.method,
        bankAccountId: payment.bank_account_id,
        date: payment.created_at,
      });

      // Update cash balance
      if (part.method === 'cash') {
        const lastCashTx = await trx('cash_transactions')
          .where({ business_id: businessId })
          .orderBy('created_at', 'desc')
          .first();
        const currentBalance = lastCashTx ? parseFloat(lastCashTx.balance_after) : 0;

        await trx('cash_transactions').insert({
          business_id: businessId,
          type: 'credit_payment',
          amount: partAmount,
          description: `Credit payment from ${credit.name}`,
          balance_after: currentBalance + partAmount,
        });
      }

      // Update bank balance
      if ((part.method === 'bank' || part.method === 'transfer') && part.bankAccountId) {
        await trx('bank_accounts')
          .where({ id: part.bankAccountId, business_id: businessId })
          .increment('balance', partAmount)
          .increment('usage_count', 1)
          .update({ updated_at: trx.fn.now() });

        await trx('bank_transactions').insert({
          bank_account_id: part.bankAccountId,
          business_id: businessId,
          type: 'credit_payment',
          amount: partAmount,
          reference_id: creditId,
          description: `Credit payment from ${credit.name}`,
        });
      }

      remainingBalance -= partAmount;
    }

    const newStatus = remainingBalance <= 0 ? 'paid' : 'pending';

    const [updatedCredit] = await trx('credits')
      .where({ id: creditId })
      .update({
        balance_remaining: Math.max(0, remainingBalance),
        status: newStatus,
        updated_at: trx.fn.now(),
      })
      .returning('*');

    // Fetch all payments for this credit
    const allPayments = await trx('credit_payments')
      .where({ credit_id: creditId })
      .orderBy('paid_at', 'desc');

    return {
      ...mapCredit(updatedCredit),
      payments: allPayments.map((p) => ({
        id: p.id,
        amount: parseFloat(p.amount) || 0,
        method: p.method,
        bankAccountId: p.bank_account_id,
        date: p.created_at,
      })),
    };
  });
}

/**
 * Delete a credit record.
 * @param {string} businessId - Business UUID
 * @param {string} id - Credit UUID
 * @returns {Promise<void>}
 */
async function deleteCredit(businessId, id) {
  const count = await db('credits')
    .where({ id, business_id: businessId })
    .del();

  if (count === 0) {
    const error = new Error('Credit not found');
    error.status = 404;
    throw error;
  }
}

module.exports = {
  list,
  create,
  update,
  recordPayment,
  delete: deleteCredit,
};
