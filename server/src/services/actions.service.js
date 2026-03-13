const db = require('../config/database');

const MAX_HISTORY = 50;

/**
 * Add an action to the history stack, capping at MAX_HISTORY entries.
 * @param {string} businessId - Business UUID
 * @param {string} userId - User UUID
 * @param {string} actionType - e.g. 'sale', 'batch_sale', 'add_item', 'edit_item', 'add_credit', 'pay_credit', 'add_expense', 'cash_transaction'
 * @param {object} data - Forward action data
 * @param {object} reverseData - Data needed to undo the action
 * @returns {Promise<object>} Created action record
 */
async function addAction(businessId, userId, actionType, data, reverseData) {
  const [action] = await db('action_history')
    .insert({
      business_id: businessId,
      user_id: userId,
      action_type: actionType,
      data: JSON.stringify(data),
      reverse_data: JSON.stringify(reverseData),
    })
    .returning('*');

  // Cap history at MAX_HISTORY entries per business
  const count = await db('action_history')
    .where({ business_id: businessId })
    .count('* as count')
    .first();

  if (parseInt(count.count) > MAX_HISTORY) {
    const oldest = await db('action_history')
      .where({ business_id: businessId })
      .orderBy('created_at', 'asc')
      .limit(parseInt(count.count) - MAX_HISTORY)
      .select('id');

    await db('action_history')
      .whereIn('id', oldest.map((o) => o.id))
      .del();
  }

  return action;
}

/**
 * Undo the most recent action for a business.
 * Reverses the action using stored reverseData. Handles all action types:
 * sale, batch_sale, add_item, edit_item, add_credit, pay_credit, add_expense, cash_transaction.
 *
 * @param {string} businessId - Business UUID
 * @param {string} userId - User performing the undo
 * @returns {Promise<{ undone: object, message: string }>}
 */
async function undo(businessId, userId) {
  const lastAction = await db('action_history')
    .where({ business_id: businessId })
    .orderBy('created_at', 'desc')
    .first();

  if (!lastAction) {
    const error = new Error('No actions to undo');
    error.status = 404;
    throw error;
  }

  const reverseData = typeof lastAction.reverse_data === 'string'
    ? JSON.parse(lastAction.reverse_data)
    : lastAction.reverse_data;
  const actionData = typeof lastAction.data === 'string'
    ? JSON.parse(lastAction.data)
    : lastAction.data;

  await db.transaction(async (trx) => {
    switch (lastAction.action_type) {
      case 'sale':
      case 'batch_sale': {
        // Reverse a sale: void the sale, restore inventory, reverse balances
        const saleIds = lastAction.action_type === 'batch_sale'
          ? reverseData.saleIds
          : [reverseData.saleId];

        for (const saleId of saleIds) {
          // Mark sale as voided
          await trx('sales')
            .where({ id: saleId, business_id: businessId })
            .update({ status: 'voided' });

          // Restore inventory
          const items = await trx('sale_items').where({ sale_id: saleId });
          for (const item of items) {
            if (item.product_id) {
              await trx('products')
                .where({ id: item.product_id, business_id: businessId })
                .increment('quantity', parseFloat(item.quantity))
                .decrement('quantity_sold', parseFloat(item.quantity))
                .update({ updated_at: trx.fn.now() });
            }
          }

          // Reverse payment balances
          const payments = await trx('sale_payments').where({ sale_id: saleId });
          for (const payment of payments) {
            if (payment.method === 'cash') {
              const lastCashTx = await trx('cash_transactions')
                .where({ business_id: businessId })
                .orderBy('created_at', 'desc')
                .first();
              const bal = lastCashTx ? parseFloat(lastCashTx.balance_after) : 0;
              await trx('cash_transactions').insert({
                business_id: businessId,
                type: 'undo',
                amount: -parseFloat(payment.amount),
                description: `Undo sale #${saleId.slice(0, 8)}`,
                balance_after: Math.max(0, bal - parseFloat(payment.amount)),
              });
            }
            if (payment.method === 'bank' && payment.bank_account_id) {
              await trx('bank_accounts')
                .where({ id: payment.bank_account_id, business_id: businessId })
                .decrement('balance', parseFloat(payment.amount))
                .update({ updated_at: trx.fn.now() });

              await trx('bank_transactions').insert({
                bank_account_id: payment.bank_account_id,
                business_id: businessId,
                type: 'undo',
                amount: -parseFloat(payment.amount),
                reference_id: saleId,
                description: `Undo sale #${saleId.slice(0, 8)}`,
              });
            }
          }
        }
        break;
      }

      case 'add_item': {
        // Reverse: soft-delete the product
        await trx('products')
          .where({ id: reverseData.productId, business_id: businessId })
          .update({ is_active: false, updated_at: trx.fn.now() });
        break;
      }

      case 'edit_item': {
        // Reverse: restore previous product state
        await trx('products')
          .where({ id: reverseData.productId, business_id: businessId })
          .update({ ...reverseData.previousData, updated_at: trx.fn.now() });
        break;
      }

      case 'add_credit': {
        // Reverse: delete the credit
        await trx('credits')
          .where({ id: reverseData.creditId, business_id: businessId })
          .del();
        break;
      }

      case 'pay_credit': {
        // Reverse: delete payment, restore credit balance, reverse cash/bank
        await trx('credit_payments')
          .where({ id: reverseData.paymentId })
          .del();

        await trx('credits')
          .where({ id: reverseData.creditId, business_id: businessId })
          .update({
            balance_remaining: reverseData.previousBalance,
            status: 'pending',
            updated_at: trx.fn.now(),
          });

        if (reverseData.method === 'cash') {
          const lastCashTx = await trx('cash_transactions')
            .where({ business_id: businessId })
            .orderBy('created_at', 'desc')
            .first();
          const bal = lastCashTx ? parseFloat(lastCashTx.balance_after) : 0;
          await trx('cash_transactions').insert({
            business_id: businessId,
            type: 'undo',
            amount: -parseFloat(reverseData.amount),
            description: `Undo credit payment`,
            balance_after: Math.max(0, bal - parseFloat(reverseData.amount)),
          });
        }
        if (reverseData.method === 'bank' && reverseData.bankAccountId) {
          await trx('bank_accounts')
            .where({ id: reverseData.bankAccountId, business_id: businessId })
            .decrement('balance', parseFloat(reverseData.amount))
            .update({ updated_at: trx.fn.now() });

          await trx('bank_transactions').insert({
            bank_account_id: reverseData.bankAccountId,
            business_id: businessId,
            type: 'undo',
            amount: -parseFloat(reverseData.amount),
            description: `Undo credit payment`,
          });
        }
        break;
      }

      case 'add_expense': {
        // Reverse: delete expense, restore cash/bank balance
        const expense = await trx('expenses')
          .where({ id: reverseData.expenseId, business_id: businessId })
          .first();

        if (expense) {
          if (expense.payment_method === 'cash') {
            const lastCashTx = await trx('cash_transactions')
              .where({ business_id: businessId })
              .orderBy('created_at', 'desc')
              .first();
            const bal = lastCashTx ? parseFloat(lastCashTx.balance_after) : 0;
            await trx('cash_transactions').insert({
              business_id: businessId,
              type: 'undo',
              amount: parseFloat(expense.amount),
              description: `Undo expense: ${expense.category}`,
              balance_after: bal + parseFloat(expense.amount),
            });
          }
          if (expense.payment_method === 'bank' && expense.bank_account_id) {
            await trx('bank_accounts')
              .where({ id: expense.bank_account_id, business_id: businessId })
              .increment('balance', parseFloat(expense.amount))
              .update({ updated_at: trx.fn.now() });

            await trx('bank_transactions').insert({
              bank_account_id: expense.bank_account_id,
              business_id: businessId,
              type: 'undo',
              amount: parseFloat(expense.amount),
              description: `Undo expense: ${expense.category}`,
            });
          }

          await trx('expenses')
            .where({ id: reverseData.expenseId })
            .del();
        }
        break;
      }

      case 'cash_transaction': {
        // Reverse: add opposite cash transaction
        const lastCashTx = await trx('cash_transactions')
          .where({ business_id: businessId })
          .orderBy('created_at', 'desc')
          .first();
        const bal = lastCashTx ? parseFloat(lastCashTx.balance_after) : 0;
        const reverseAmount = -parseFloat(reverseData.amount);
        const newBal = Math.max(0, bal + reverseAmount);

        await trx('cash_transactions').insert({
          business_id: businessId,
          type: 'undo',
          amount: reverseAmount,
          description: `Undo: ${reverseData.description || 'cash transaction'}`,
          balance_after: newBal,
        });
        break;
      }

      default: {
        const error = new Error(`Unknown action type: ${lastAction.action_type}`);
        error.status = 400;
        throw error;
      }
    }

    // Remove the undone action from history
    await trx('action_history').where({ id: lastAction.id }).del();
  });

  return {
    undone: lastAction,
    message: `Successfully undone: ${lastAction.action_type}`,
  };
}

/**
 * Redo the last undone action. Currently not implemented — requires a separate
 * redo stack. Placeholder for future implementation.
 * @param {string} businessId - Business UUID
 * @param {string} userId - User performing the redo
 * @returns {Promise<{ message: string }>}
 */
async function redo(businessId, userId) {
  // TODO: Implement redo stack. Requires storing undone actions in a separate
  // table or adding an 'undone' flag to action_history.
  const error = new Error('Redo is not yet implemented');
  error.status = 501;
  throw error;
}

/**
 * Get action history for a business.
 * @param {string} businessId - Business UUID
 * @param {object} query - { limit }
 * @returns {Promise<object[]>}
 */
async function getHistory(businessId, query = {}) {
  const { limit = 50 } = query;

  return db('action_history')
    .where({ business_id: businessId })
    .orderBy('created_at', 'desc')
    .limit(parseInt(limit));
}

module.exports = {
  addAction,
  undo,
  redo,
  getHistory,
};
