const db = require('../config/database');

/**
 * Aggregate financial dashboard for a business.
 * Combines cash, bank, credits, expenses, and inventory data.
 *
 * @param {string} businessId - Business UUID
 * @returns {Promise<{
 *   physicalCash: number,
 *   bankBalance: number,
 *   customerCredits: number,
 *   supplierCredits: number,
 *   totalExpenses: number,
 *   inventoryValue: number,
 *   realizedProfit: number,
 *   netPosition: number
 * }>}
 */
async function getFinancialSnapshot(businessId) {
  // Physical cash balance
  const lastCashTx = await db('cash_transactions')
    .where({ business_id: businessId })
    .orderBy('created_at', 'desc')
    .first();
  const physicalCash = lastCashTx ? (parseFloat(lastCashTx.balance_after) || 0) : 0;

  // Total bank balance
  const bankResult = await db('bank_accounts')
    .where({ business_id: businessId, is_active: true })
    .sum('balance as total')
    .first();
  const bankBalance = parseFloat(bankResult?.total || 0) || 0;

  // Outstanding customer credits (money owed TO business)
  const customerCreditResult = await db('credits')
    .where({ business_id: businessId, type: 'customer', status: 'pending' })
    .sum('balance_remaining as total')
    .first();
  const customerCredits = parseFloat(customerCreditResult?.total || 0) || 0;

  // Outstanding supplier credits (money business OWES)
  const supplierCreditResult = await db('credits')
    .where({ business_id: businessId, type: 'supplier', status: 'pending' })
    .sum('balance_remaining as total')
    .first();
  const supplierCredits = parseFloat(supplierCreditResult?.total || 0) || 0;

  // Total expenses this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const expenseResult = await db('expenses')
    .where({ business_id: businessId })
    .where('date', '>=', monthStart)
    .sum('amount as total')
    .first();
  const totalExpenses = parseFloat(expenseResult?.total || 0) || 0;

  // Inventory value (buy_price * quantity for active products)
  const inventoryResult = await db('products')
    .where({ business_id: businessId, is_active: true })
    .select(db.raw('COALESCE(SUM(buy_price * quantity), 0) as total'))
    .first();
  const inventoryValue = parseFloat(inventoryResult?.total || 0) || 0;

  // Realized profit (total profit from completed sales)
  const profitResult = await db('sales')
    .where({ business_id: businessId, status: 'completed' })
    .sum('profit as total')
    .first();
  const realizedProfit = parseFloat(profitResult?.total || 0) || 0;

  // Net position: cash + bank + inventory + customerCredits - supplierCredits
  const netPosition = physicalCash + bankBalance + inventoryValue + customerCredits - supplierCredits;

  return {
    physicalCash,
    bankBalance,
    customerCredits,
    supplierCredits,
    totalExpenses,
    inventoryValue,
    realizedProfit,
    netPosition,
  };
}

module.exports = {
  getFinancialSnapshot,
};
