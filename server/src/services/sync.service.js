const db = require('../config/database');

/**
 * Process offline changes pushed from client.
 * Applies each change in order, handling conflicts via last-write-wins.
 *
 * @param {string} businessId - Business UUID
 * @param {string} userId - User UUID
 * @param {object} body - { changes: [{ table, action: 'insert'|'update'|'delete', id?, data?, timestamp }] }
 * @returns {Promise<{ applied: number, conflicts: object[], serverTimestamp: string }>}
 */
async function push(businessId, userId, body) {
  const { changes = [] } = body;
  const conflicts = [];
  let applied = 0;

  const allowedTables = [
    'products', 'sales', 'sale_items', 'sale_payments',
    'customers', 'credits', 'credit_payments', 'expenses',
    'cash_transactions', 'bank_transactions',
  ];

  await db.transaction(async (trx) => {
    for (const change of changes) {
      const { table, action, id, data, timestamp } = change;

      // Validate table name against whitelist
      if (!allowedTables.includes(table)) {
        conflicts.push({ ...change, reason: `Table "${table}" not allowed` });
        continue;
      }

      try {
        if (action === 'insert') {
          const insertData = { ...data, business_id: businessId };
          await trx(table).insert(insertData).onConflict('id').ignore();
          applied++;
        } else if (action === 'update' && id) {
          // Last-write-wins: check if server version is newer
          const serverRecord = await trx(table)
            .where({ id, business_id: businessId })
            .first();

          if (!serverRecord) {
            conflicts.push({ ...change, reason: 'Record not found on server' });
            continue;
          }

          if (serverRecord.updated_at && timestamp) {
            const serverTime = new Date(serverRecord.updated_at).getTime();
            const clientTime = new Date(timestamp).getTime();
            if (serverTime > clientTime) {
              conflicts.push({
                ...change,
                reason: 'Server version is newer',
                serverData: serverRecord,
              });
              continue;
            }
          }

          const updateData = { ...data };
          delete updateData.id;
          delete updateData.business_id;
          if (updateData.updated_at === undefined) {
            updateData.updated_at = trx.fn.now();
          }

          await trx(table)
            .where({ id, business_id: businessId })
            .update(updateData);
          applied++;
        } else if (action === 'delete' && id) {
          await trx(table)
            .where({ id, business_id: businessId })
            .del();
          applied++;
        } else {
          conflicts.push({ ...change, reason: 'Invalid action or missing id' });
        }
      } catch (err) {
        conflicts.push({ ...change, reason: err.message });
      }
    }
  });

  return {
    applied,
    conflicts,
    serverTimestamp: new Date().toISOString(),
  };
}

/**
 * Pull changes since a given timestamp for delta sync.
 * Returns all records modified after the given timestamp.
 *
 * @param {string} businessId - Business UUID
 * @param {object} query - { since: ISO timestamp }
 * @returns {Promise<{ changes: object, serverTimestamp: string }>}
 */
async function pull(businessId, query = {}) {
  const { since } = query;
  const sinceDate = since ? new Date(since) : new Date(0);

  const tables = [
    { name: 'products', timeCol: 'updated_at' },
    { name: 'customers', timeCol: 'updated_at' },
    { name: 'sales', timeCol: 'created_at' },
    { name: 'credits', timeCol: 'updated_at' },
    { name: 'expenses', timeCol: 'created_at' },
    { name: 'bank_accounts', timeCol: 'updated_at' },
  ];

  const changes = {};

  for (const { name, timeCol } of tables) {
    changes[name] = await db(name)
      .where({ business_id: businessId })
      .where(timeCol, '>', sinceDate)
      .orderBy(timeCol, 'asc');
  }

  // Tables without business_id directly - fetch via joins
  if (changes.sales && changes.sales.length > 0) {
    const saleIds = changes.sales.map((s) => s.id);
    changes.sale_items = await db('sale_items').whereIn('sale_id', saleIds);
    changes.sale_payments = await db('sale_payments').whereIn('sale_id', saleIds);
  }

  // Cash transactions
  changes.cash_transactions = await db('cash_transactions')
    .where({ business_id: businessId })
    .where('created_at', '>', sinceDate)
    .orderBy('created_at', 'asc');

  return {
    changes,
    serverTimestamp: new Date().toISOString(),
  };
}

module.exports = {
  push,
  pull,
};
