const db = require('../config/database');

/**
 * List customers with search and pagination.
 * @param {string} businessId - Business UUID
 * @param {object} query - { search, page, limit }
 * @returns {Promise<{ customers: object[], total: number }>}
 */
async function list(businessId, query = {}) {
  const { search, page = 1, limit = 50 } = query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  let builder = db('customers').where({ business_id: businessId });

  if (search) {
    builder = builder.where(function () {
      this.whereILike('name', `%${search}%`)
        .orWhereILike('phone', `%${search}%`);
    });
  }

  const [{ count }] = await builder.clone().count('* as count');
  const customers = await builder
    .orderBy('name', 'asc')
    .limit(parseInt(limit))
    .offset(offset);

  return { customers, total: parseInt(count) };
}

/**
 * Create a new customer.
 * @param {string} businessId - Business UUID
 * @param {object} data - { name, phone?, creditLimit?, notes? }
 * @returns {Promise<object>}
 */
async function create(businessId, data) {
  const [customer] = await db('customers')
    .insert({
      business_id: businessId,
      name: data.name,
      phone: data.phone || null,
      credit_limit: parseFloat(data.creditLimit || data.credit_limit || 0),
      notes: data.notes || null,
    })
    .returning('*');

  return customer;
}

/**
 * Get a single customer with their credit and purchase history.
 * @param {string} businessId - Business UUID
 * @param {string} id - Customer UUID
 * @returns {Promise<object|null>}
 */
async function getById(businessId, id) {
  const customer = await db('customers')
    .where({ id, business_id: businessId })
    .first();

  if (!customer) return null;

  const [credits, recentSales] = await Promise.all([
    db('credits')
      .where({ business_id: businessId, customer_id: id })
      .orderBy('created_at', 'desc'),
    db('sales')
      .where({ business_id: businessId, customer_id: id })
      .orderBy('created_at', 'desc')
      .limit(20),
  ]);

  return { ...customer, credits, recentSales };
}

/**
 * Update a customer.
 * @param {string} businessId - Business UUID
 * @param {string} id - Customer UUID
 * @param {object} data - Fields to update
 * @returns {Promise<object>}
 */
async function update(businessId, id, data) {
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.creditLimit !== undefined || data.credit_limit !== undefined)
    updates.credit_limit = parseFloat(data.creditLimit || data.credit_limit);
  if (data.notes !== undefined) updates.notes = data.notes;
  updates.updated_at = db.fn.now();

  const [customer] = await db('customers')
    .where({ id, business_id: businessId })
    .update(updates)
    .returning('*');

  if (!customer) {
    const error = new Error('Customer not found');
    error.status = 404;
    throw error;
  }

  return customer;
}

/**
 * Delete a customer.
 * @param {string} businessId - Business UUID
 * @param {string} id - Customer UUID
 * @returns {Promise<void>}
 */
async function deleteCustomer(businessId, id) {
  const count = await db('customers')
    .where({ id, business_id: businessId })
    .del();

  if (count === 0) {
    const error = new Error('Customer not found');
    error.status = 404;
    throw error;
  }
}

/**
 * Get purchase history for a customer.
 * @param {string} businessId - Business UUID
 * @param {string} customerId - Customer UUID
 * @returns {Promise<object[]>}
 */
async function getHistory(businessId, customerId) {
  return db('sales')
    .where({ business_id: businessId, customer_id: customerId })
    .orderBy('created_at', 'desc');
}

module.exports = {
  list,
  create,
  getById,
  update,
  delete: deleteCustomer,
  getHistory,
};
