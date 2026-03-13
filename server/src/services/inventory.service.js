const db = require('../config/database');

/**
 * Map snake_case DB fields to camelCase for client consumption.
 */
function mapProductFields(product) {
  return {
    ...product,
    sellPrice: product.sell_price,
    buyPrice: product.buy_price,
    unitPrice: product.sell_price,
    lowStockThreshold: product.low_stock_threshold,
    quantitySold: product.quantity_sold,
  };
}

/**
 * List products for a business with pagination, search, and category filter.
 * @param {string} businessId - Business UUID
 * @param {object} query - { search, category, page, limit }
 * @returns {Promise<{ products: object[], total: number, page: number, limit: number }>}
 */
async function list(businessId, query = {}) {
  const { search, category, page = 1, limit = 50 } = query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  let builder = db('products')
    .where({ business_id: businessId, is_active: true });

  if (search) {
    builder = builder.where(function () {
      this.whereILike('name', `%${search}%`)
        .orWhereILike('barcode', `%${search}%`);
    });
  }

  if (category) {
    builder = builder.andWhere({ category });
  }

  const [{ count }] = await builder.clone().count('* as count');
  const rawProducts = await builder
    .orderBy('name', 'asc')
    .limit(parseInt(limit))
    .offset(offset);
  const products = rawProducts.map(mapProductFields);

  return {
    products,
    total: parseInt(count),
    page: parseInt(page),
    limit: parseInt(limit),
  };
}

/**
 * Get a single product by ID, scoped to business.
 * @param {string} businessId - Business UUID
 * @param {string} id - Product UUID
 * @returns {Promise<object|null>}
 */
async function getById(businessId, id) {
  const product = await db('products')
    .where({ id, business_id: businessId })
    .first();
  if (!product) return null;
  return mapProductFields(product);
}

/**
 * Create a new product.
 * @param {string} businessId - Business UUID
 * @param {object} data - Product fields
 * @returns {Promise<object>} Created product
 */
async function generateBarcode(businessId) {
  const [{ count }] = await db('products').where({ business_id: businessId }).count('* as count');
  const seq = String(Number(count) + 1).padStart(6, '0');
  return `BZ${seq}`;
}

async function create(businessId, data) {
  const barcode = data.barcode || await generateBarcode(businessId);
  const [product] = await db('products')
    .insert({
      business_id: businessId,
      name: data.name,
      barcode,
      category: data.category || null,
      unit: data.unit || 'pcs',
      buy_price: data.buy_price ?? data.buyPrice ?? 0,
      sell_price: data.sell_price ?? data.sellPrice ?? 0,
      quantity: data.quantity || 0,
      low_stock_threshold: data.low_stock_threshold ?? data.lowStockThreshold ?? 10,
      image_url: data.image_url ?? data.imageUrl ?? null,
      parent_product_id: data.parent_product_id ?? data.parentProductId ?? null,
      variant_label: data.variant_label ?? data.variantLabel ?? null,
    })
    .returning('*');

  return mapProductFields(product);
}

/**
 * Update an existing product.
 * @param {string} businessId - Business UUID
 * @param {string} id - Product UUID
 * @param {object} data - Fields to update
 * @returns {Promise<object>} Updated product
 */
async function update(businessId, id, data) {
  // Map camelCase from client to snake_case for DB
  const fieldMap = {
    name: 'name', barcode: 'barcode', category: 'category', unit: 'unit',
    buy_price: 'buy_price', buyPrice: 'buy_price',
    sell_price: 'sell_price', sellPrice: 'sell_price',
    quantity: 'quantity',
    low_stock_threshold: 'low_stock_threshold', lowStockThreshold: 'low_stock_threshold',
    image_url: 'image_url', imageUrl: 'image_url',
    parent_product_id: 'parent_product_id', parentProductId: 'parent_product_id',
    variant_label: 'variant_label', variantLabel: 'variant_label',
  };
  const updates = {};
  for (const [clientKey, dbKey] of Object.entries(fieldMap)) {
    if (data[clientKey] !== undefined) {
      updates[dbKey] = data[clientKey];
    }
  }
  updates.updated_at = db.fn.now();

  const [product] = await db('products')
    .where({ id, business_id: businessId })
    .update(updates)
    .returning('*');

  if (!product) {
    const error = new Error('Product not found');
    error.status = 404;
    throw error;
  }

  return mapProductFields(product);
}

/**
 * Soft-delete a product by setting is_active to false.
 * @param {string} businessId - Business UUID
 * @param {string} id - Product UUID
 * @returns {Promise<void>}
 */
async function softDelete(businessId, id) {
  const count = await db('products')
    .where({ id, business_id: businessId })
    .update({ is_active: false, updated_at: db.fn.now() });

  if (count === 0) {
    const error = new Error('Product not found');
    error.status = 404;
    throw error;
  }
}

/**
 * Find a product by barcode, scoped to business.
 * @param {string} businessId - Business UUID
 * @param {string} barcode - Barcode string
 * @returns {Promise<object|null>}
 */
async function findByBarcode(businessId, barcode) {
  const product = await db('products')
    .where({ business_id: businessId, barcode, is_active: true })
    .first();
  if (!product) return null;
  return mapProductFields(product);
}

/**
 * Get all products below their low stock threshold.
 * @param {string} businessId - Business UUID
 * @returns {Promise<object[]>}
 */
async function getLowStock(businessId) {
  return db('products')
    .where({ business_id: businessId, is_active: true })
    .whereRaw('quantity <= low_stock_threshold')
    .orderBy('quantity', 'asc');
}

/**
 * Bulk import products from an array.
 * @param {string} businessId - Business UUID
 * @param {object} body - { products: object[] }
 * @returns {Promise<{ imported: number, errors: object[] }>}
 */
async function bulkImport(businessId, body) {
  const { products } = body;
  const errors = [];
  let imported = 0;

  await db.transaction(async (trx) => {
    for (let i = 0; i < products.length; i++) {
      try {
        const p = products[i];
        await trx('products').insert({
          business_id: businessId,
          name: p.name,
          barcode: p.barcode || null,
          category: p.category || null,
          unit: p.unit || 'pcs',
          buy_price: p.buy_price || 0,
          sell_price: p.sell_price || 0,
          quantity: p.quantity || 0,
          low_stock_threshold: p.low_stock_threshold || 10,
        });
        imported++;
      } catch (err) {
        errors.push({ row: i + 1, name: products[i].name, error: err.message });
      }
    }
  });

  return { imported, errors };
}

module.exports = {
  list,
  getById,
  create,
  update,
  softDelete,
  findByBarcode,
  getLowStock,
  bulkImport,
};
