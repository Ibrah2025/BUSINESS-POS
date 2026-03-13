exports.up = async function (knex) {
  await knex.schema.createTable('product_prices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.string('tier_name', 50).notNullable();
    table.integer('min_quantity').defaultTo(1);
    table.decimal('price', 15, 2).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('product_prices');
};
