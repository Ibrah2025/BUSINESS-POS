const db = require('../config/database');

/**
 * Create a new sale with items, payments, inventory deduction, and balance updates.
 * Handles immediate sales, split payments, and pending/credit items.
 *
 * @param {string} businessId - Business UUID
 * @param {string} attendantId - Authenticated user UUID
 * @param {object} body - {
 *   items: [{ productId, quantity, unitPrice, buyPrice, productName }],
 *   payments: [{ method: 'cash'|'bank'|'credit', amount, bankAccountId?, creditId? }],
 *   customerId?, customerName?, discount?, notes?
 * }
 * @returns {Promise<object>} Created sale with items and payments
 */
async function create(businessId, attendantId, body) {
  const {
    items,
    payments,
    customerId,
    customerName,
    discount = 0,
    notes,
  } = body;

  if (!items || items.length === 0) {
    const error = new Error('Sale must have at least one item');
    error.status = 400;
    throw error;
  }

  if (!payments || payments.length === 0) {
    const error = new Error('Sale must have at least one payment');
    error.status = 400;
    throw error;
  }

  // Calculate totals
  let totalAmount = 0;
  let totalProfit = 0;
  const itemRows = items.map((item) => {
    const lineTotal = parseFloat(item.unitPrice) * parseFloat(item.quantity);
    const lineProfit =
      (parseFloat(item.unitPrice) - parseFloat(item.buyPrice || 0)) *
      parseFloat(item.quantity);
    totalAmount += lineTotal;
    totalProfit += lineProfit;
    return {
      product_id: item.productId,
      product_name: item.productName,
      quantity: parseFloat(item.quantity),
      unit_price: parseFloat(item.unitPrice),
      buy_price: parseFloat(item.buyPrice || 0),
      profit: lineProfit,
    };
  });

  totalAmount -= parseFloat(discount);
  totalProfit -= parseFloat(discount);

  // Validate payment sum matches total
  const paymentSum = payments.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0
  );
  if (Math.abs(paymentSum - totalAmount) > 0.01) {
    const error = new Error(
      `Payment total (${paymentSum}) does not match sale total (${totalAmount})`
    );
    error.status = 400;
    throw error;
  }

  const sale = await db.transaction(async (trx) => {
    // 1. Create the sale record
    const [saleRecord] = await trx('sales')
      .insert({
        business_id: businessId,
        attendant_id: attendantId,
        customer_id: customerId || null,
        customer_name: customerName || null,
        total_amount: totalAmount,
        discount: parseFloat(discount),
        profit: totalProfit,
        notes: notes || null,
        status: 'completed',
      })
      .returning('*');

    // 2. Create sale items
    const saleItems = await trx('sale_items')
      .insert(
        itemRows.map((item) => ({
          sale_id: saleRecord.id,
          ...item,
        }))
      )
      .returning('*');

    // 3. Validate inventory and deduct for each item
    for (const item of items) {
      if (item.productId) {
        const product = await trx('products')
          .where({ id: item.productId, business_id: businessId })
          .first();
        if (!product) {
          const error = new Error(`Product not found: ${item.productId}`);
          error.status = 404;
          throw error;
        }
        if (product.quantity < parseFloat(item.quantity)) {
          const error = new Error(
            `Insufficient stock for ${product.name}: ${product.quantity} available, ${item.quantity} requested`
          );
          error.status = 400;
          throw error;
        }
        await trx('products')
          .where({ id: item.productId, business_id: businessId })
          .decrement('quantity', parseFloat(item.quantity))
          .increment('quantity_sold', parseFloat(item.quantity))
          .update({ updated_at: trx.fn.now() });
      }
    }

    // 4. Process each payment method
    const salePayments = [];
    for (const payment of payments) {
      const [paymentRecord] = await trx('sale_payments')
        .insert({
          sale_id: saleRecord.id,
          method: payment.method,
          amount: parseFloat(payment.amount),
          bank_account_id: payment.bankAccountId || null,
          credit_id: payment.creditId || null,
        })
        .returning('*');
      salePayments.push(paymentRecord);

      // Update cash balance
      if (payment.method === 'cash') {
        const lastCashTx = await trx('cash_transactions')
          .where({ business_id: businessId })
          .orderBy('created_at', 'desc')
          .first();
        const currentBalance = lastCashTx
          ? parseFloat(lastCashTx.balance_after)
          : 0;
        const newBalance = currentBalance + parseFloat(payment.amount);

        await trx('cash_transactions').insert({
          business_id: businessId,
          type: 'sale',
          amount: parseFloat(payment.amount),
          description: `Sale #${saleRecord.id.slice(0, 8)}`,
          balance_after: newBalance,
        });
      }

      // Update bank account balance
      if (payment.method === 'bank' && payment.bankAccountId) {
        await trx('bank_accounts')
          .where({ id: payment.bankAccountId, business_id: businessId })
          .increment('balance', parseFloat(payment.amount))
          .increment('usage_count', 1)
          .update({ updated_at: trx.fn.now() });

        await trx('bank_transactions').insert({
          bank_account_id: payment.bankAccountId,
          business_id: businessId,
          type: 'sale',
          amount: parseFloat(payment.amount),
          reference_id: saleRecord.id,
          description: `Sale #${saleRecord.id.slice(0, 8)}`,
        });
      }

      // Create credit record if paying on credit
      if (payment.method === 'credit') {
        if (payment.creditId) {
          // Add to existing credit
          await trx('credits')
            .where({ id: payment.creditId, business_id: businessId })
            .increment('total_amount', parseFloat(payment.amount))
            .increment('balance_remaining', parseFloat(payment.amount))
            .update({ updated_at: trx.fn.now() });
        } else {
          // Create new customer credit
          await trx('credits').insert({
            business_id: businessId,
            customer_id: customerId || null,
            type: 'customer',
            name: customerName || 'Walk-in Customer',
            total_amount: parseFloat(payment.amount),
            balance_remaining: parseFloat(payment.amount),
            status: 'pending',
            items_description: items.map((i) => i.productName).join(', '),
          });
        }
      }
    }

    // 5. Update customer total_purchases
    if (customerId) {
      await trx('customers')
        .where({ id: customerId, business_id: businessId })
        .increment('total_purchases', totalAmount)
        .update({ last_purchase_at: trx.fn.now(), updated_at: trx.fn.now() });
    }

    return {
      ...saleRecord,
      items: saleItems,
      payments: salePayments,
    };
  });

  return sale;
}

/**
 * List sales with pagination and optional filters.
 * @param {string} businessId - Business UUID
 * @param {object} query - { page, limit, startDate, endDate, status, attendantId }
 * @returns {Promise<{ sales: object[], total: number, page: number, limit: number }>}
 */
async function list(businessId, query = {}) {
  const { page = 1, limit = 20, startDate, endDate, status, attendantId } = query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  let builder = db('sales').where({ business_id: businessId });

  if (startDate) {
    builder = builder.where('created_at', '>=', startDate);
  }
  if (endDate) {
    builder = builder.where('created_at', '<=', endDate);
  }
  if (status) {
    builder = builder.andWhere({ status });
  }
  if (attendantId) {
    builder = builder.andWhere({ attendant_id: attendantId });
  }

  const [{ count }] = await builder.clone().count('* as count');

  const sales = await builder
    .select(
      'id', 'total_amount', 'discount', 'profit', 'customer_name',
      'status', 'created_at', 'attendant_id'
    )
    .orderBy('created_at', 'desc')
    .limit(parseInt(limit))
    .offset(offset);

  // Attach items and payments for each sale
  if (sales.length > 0) {
    const saleIds = sales.map((s) => s.id);
    const [allItems, allPayments] = await Promise.all([
      db('sale_items')
        .whereIn('sale_id', saleIds)
        .join('products', 'sale_items.product_id', 'products.id')
        .select('sale_items.*', 'products.name'),
      db('sale_payments').whereIn('sale_id', saleIds),
    ]);
    const itemsBySale = {};
    allItems.forEach((item) => {
      if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
      itemsBySale[item.sale_id].push(item);
    });
    const paymentsBySale = {};
    allPayments.forEach((p) => {
      if (!paymentsBySale[p.sale_id]) paymentsBySale[p.sale_id] = [];
      paymentsBySale[p.sale_id].push(p);
    });
    sales.forEach((s) => {
      s.items = itemsBySale[s.id] || [];
      s.payments = paymentsBySale[s.id] || [];
    });
  }

  return {
    sales,
    total: parseInt(count),
    page: parseInt(page),
    limit: parseInt(limit),
  };
}

/**
 * Get a single sale with its items and payments.
 * @param {string} businessId - Business UUID
 * @param {string} id - Sale UUID
 * @returns {Promise<object|null>}
 */
async function getById(businessId, id) {
  const sale = await db('sales')
    .where({ id, business_id: businessId })
    .first();

  if (!sale) return null;

  const [items, payments] = await Promise.all([
    db('sale_items').where({ sale_id: id }),
    db('sale_payments').where({ sale_id: id }),
  ]);

  return { ...sale, items, payments };
}

/**
 * Get today's sales summary for a business.
 * @param {string} businessId - Business UUID
 * @returns {Promise<{ totalSales: number, totalProfit: number, transactionCount: number, cashTotal: number, bankTotal: number }>}
 */
async function todaySummary(businessId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const salesResult = await db('sales')
    .where({ business_id: businessId, status: 'completed' })
    .where('created_at', '>=', todayStart)
    .select(
      db.raw('COALESCE(SUM(total_amount), 0) as total_sales'),
      db.raw('COALESCE(SUM(profit), 0) as total_profit'),
      db.raw('COUNT(*) as transaction_count')
    )
    .first();

  // Get payment method breakdown for today's sales
  const paymentBreakdown = await db('sale_payments')
    .join('sales', 'sales.id', 'sale_payments.sale_id')
    .where({ 'sales.business_id': businessId, 'sales.status': 'completed' })
    .where('sales.created_at', '>=', todayStart)
    .select('sale_payments.method')
    .sum('sale_payments.amount as total')
    .groupBy('sale_payments.method');

  const cashTotal = parseFloat(
    paymentBreakdown.find((p) => p.method === 'cash')?.total || 0
  );
  const bankTotal = parseFloat(
    paymentBreakdown.find((p) => p.method === 'bank')?.total || 0
  );

  return {
    totalSales: parseFloat(salesResult.total_sales),
    totalProfit: parseFloat(salesResult.total_profit),
    transactionCount: parseInt(salesResult.transaction_count),
    cashTotal,
    bankTotal,
  };
}

/**
 * Get daily sales data for a calendar month view.
 * @param {string} businessId - Business UUID
 * @param {string|number} year - Year
 * @param {string|number} month - Month (1-12)
 * @returns {Promise<object[]>} Array of { date, totalSales, totalProfit, transactionCount }
 */
async function calendarData(businessId, year, month) {
  const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
  const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

  const data = await db('sales')
    .where({ business_id: businessId, status: 'completed' })
    .whereBetween('created_at', [startDate, endDate])
    .select(
      db.raw("DATE(created_at) as date"),
      db.raw('COALESCE(SUM(total_amount), 0) as total_sales'),
      db.raw('COALESCE(SUM(profit), 0) as total_profit'),
      db.raw('COUNT(*) as transaction_count')
    )
    .groupByRaw('DATE(created_at)')
    .orderBy('date', 'asc');

  return data;
}

/**
 * Void a completed sale: mark as voided, restore inventory, reverse balances.
 * @param {string} businessId - Business UUID
 * @param {string} saleId - Sale UUID
 * @returns {Promise<object>} Voided sale
 */
async function voidSale(businessId, userId, saleId) {
  return db.transaction(async (trx) => {
    const sale = await trx('sales')
      .where({ id: saleId, business_id: businessId, status: 'completed' })
      .first();

    if (!sale) {
      const error = new Error('Sale not found or already voided');
      error.status = 404;
      throw error;
    }

    // Mark sale as voided
    await trx('sales')
      .where({ id: saleId })
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
        const currentBalance = lastCashTx
          ? parseFloat(lastCashTx.balance_after)
          : 0;
        const newBalance = Math.max(0, currentBalance - parseFloat(payment.amount));

        await trx('cash_transactions').insert({
          business_id: businessId,
          type: 'void',
          amount: -parseFloat(payment.amount),
          description: `Void sale #${saleId.slice(0, 8)}`,
          balance_after: newBalance,
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
          type: 'void',
          amount: -parseFloat(payment.amount),
          reference_id: saleId,
          description: `Void sale #${saleId.slice(0, 8)}`,
        });
      }
    }

    return { ...sale, status: 'voided' };
  });
}

module.exports = {
  create,
  list,
  getById,
  todaySummary,
  calendarData,
  voidSale,
};
