const db = require('../config/database');

/**
 * Create a return: restore inventory, issue refund, create return record.
 * @param {string} businessId - Business UUID
 * @param {string} attendantId - Authenticated user UUID
 * @param {object} body - {
 *   saleId, items: [{ saleItemId, productId, quantity, refundAmount }],
 *   reason?, refundMethod: 'cash'|'bank', bankAccountId?
 * }
 * @returns {Promise<object>} Created return with items
 */
async function create(businessId, attendantId, body) {
  const { saleId, items, reason, refundMethod, bankAccountId } = body;

  if (!items || items.length === 0) {
    const error = new Error('Return must have at least one item');
    error.status = 400;
    throw error;
  }

  // Validate sale belongs to business
  const sale = await db('sales')
    .where({ id: saleId, business_id: businessId, status: 'completed' })
    .first();

  if (!sale) {
    const error = new Error('Sale not found or already voided');
    error.status = 404;
    throw error;
  }

  const totalRefund = items.reduce(
    (sum, item) => sum + parseFloat(item.refundAmount),
    0
  );

  const result = await db.transaction(async (trx) => {
    // 1. Create return record
    const [returnRecord] = await trx('returns')
      .insert({
        sale_id: saleId,
        business_id: businessId,
        attendant_id: attendantId,
        reason: reason || null,
        total_refund: totalRefund,
        refund_method: refundMethod,
      })
      .returning('*');

    // 2. Create return items and restore inventory
    const returnItems = [];
    for (const item of items) {
      const [ri] = await trx('return_items')
        .insert({
          return_id: returnRecord.id,
          sale_item_id: item.saleItemId,
          product_id: item.productId || null,
          quantity: parseFloat(item.quantity),
          refund_amount: parseFloat(item.refundAmount),
        })
        .returning('*');
      returnItems.push(ri);

      // Restore product inventory
      if (item.productId) {
        await trx('products')
          .where({ id: item.productId, business_id: businessId })
          .increment('quantity', parseFloat(item.quantity))
          .decrement('quantity_sold', parseFloat(item.quantity))
          .update({ updated_at: trx.fn.now() });
      }
    }

    // 3. Process refund
    if (refundMethod === 'cash') {
      const lastCashTx = await trx('cash_transactions')
        .where({ business_id: businessId })
        .orderBy('created_at', 'desc')
        .first();
      const currentBalance = lastCashTx
        ? parseFloat(lastCashTx.balance_after)
        : 0;
      const newBalance = Math.max(0, currentBalance - totalRefund);

      await trx('cash_transactions').insert({
        business_id: businessId,
        type: 'refund',
        amount: -totalRefund,
        description: `Refund for sale #${saleId.slice(0, 8)}`,
        balance_after: newBalance,
      });
    }

    if (refundMethod === 'bank' && bankAccountId) {
      await trx('bank_accounts')
        .where({ id: bankAccountId, business_id: businessId })
        .decrement('balance', totalRefund)
        .update({ updated_at: trx.fn.now() });

      await trx('bank_transactions').insert({
        bank_account_id: bankAccountId,
        business_id: businessId,
        type: 'refund',
        amount: -totalRefund,
        reference_id: returnRecord.id,
        description: `Refund for sale #${saleId.slice(0, 8)}`,
      });
    }

    return { ...returnRecord, items: returnItems };
  });

  return result;
}

/**
 * List returns for a business with optional filters.
 * @param {string} businessId - Business UUID
 * @param {object} query - { page, limit, startDate, endDate }
 * @returns {Promise<{ returns: object[], total: number, page: number, limit: number }>}
 */
async function list(businessId, query = {}) {
  const { page = 1, limit = 20, startDate, endDate } = query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  let builder = db('returns').where({ business_id: businessId });

  if (startDate) {
    builder = builder.where('created_at', '>=', startDate);
  }
  if (endDate) {
    builder = builder.where('created_at', '<=', endDate);
  }

  const [{ count }] = await builder.clone().count('* as count');
  const returns = await builder
    .orderBy('created_at', 'desc')
    .limit(parseInt(limit))
    .offset(offset);

  return {
    returns,
    total: parseInt(count),
    page: parseInt(page),
    limit: parseInt(limit),
  };
}

/**
 * Get a single return with its items.
 * @param {string} businessId - Business UUID
 * @param {string} id - Return UUID
 * @returns {Promise<object|null>}
 */
async function getById(businessId, id) {
  const returnRecord = await db('returns')
    .where({ id, business_id: businessId })
    .first();

  if (!returnRecord) return null;

  const items = await db('return_items').where({ return_id: id });
  return { ...returnRecord, items };
}

module.exports = {
  create,
  list,
  getById,
};
