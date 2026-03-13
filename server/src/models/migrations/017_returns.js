exports.up = async function (knex) {
  await knex.schema.createTable('returns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('sale_id').notNullable().references('id').inTable('sales').onDelete('CASCADE');
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('attendant_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('reason').nullable();
    table.decimal('total_refund', 15, 2).notNullable();
    table.string('refund_method', 20).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['business_id', 'created_at']);
  });

  await knex.schema.createTable('return_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('return_id').notNullable().references('id').inTable('returns').onDelete('CASCADE');
    table.uuid('sale_item_id').notNullable().references('id').inTable('sale_items').onDelete('CASCADE');
    table.uuid('product_id').nullable().references('id').inTable('products').onDelete('SET NULL');
    table.decimal('quantity', 15, 2).notNullable();
    table.decimal('refund_amount', 15, 2).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('return_items');
  await knex.schema.dropTableIfExists('returns');
};
