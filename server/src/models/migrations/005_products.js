exports.up = async function (knex) {
  await knex.schema.createTable('products', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('barcode', 100).nullable();
    table.string('name', 255).notNullable();
    table.string('category', 100).nullable();
    table.string('unit', 20).defaultTo('pcs');
    table.decimal('buy_price', 15, 2).defaultTo(0);
    table.decimal('sell_price', 15, 2).defaultTo(0);
    table.decimal('quantity', 15, 2).defaultTo(0);
    table.decimal('quantity_sold', 15, 2).defaultTo(0);
    table.integer('low_stock_threshold').defaultTo(10);
    table.uuid('parent_product_id').nullable().references('id').inTable('products').onDelete('SET NULL');
    table.string('variant_label', 100).nullable();
    table.text('image_url').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index(['business_id', 'name']);
    table.index(['business_id', 'category']);
  });

  await knex.raw(`
    CREATE UNIQUE INDEX products_business_id_barcode_unique
    ON products (business_id, barcode)
    WHERE barcode IS NOT NULL
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('products');
};
