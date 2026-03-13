exports.up = async function (knex) {
  await knex.schema.createTable('sale_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('sale_id').notNullable().references('id').inTable('sales').onDelete('CASCADE');
    table.uuid('product_id').nullable().references('id').inTable('products').onDelete('SET NULL');
    table.decimal('quantity', 15, 2).notNullable();
    table.decimal('unit_price', 15, 2).notNullable();
    table.decimal('buy_price', 15, 2).defaultTo(0);
    table.decimal('profit', 15, 2).defaultTo(0);
    table.string('product_name', 255).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('sale_items');
};
