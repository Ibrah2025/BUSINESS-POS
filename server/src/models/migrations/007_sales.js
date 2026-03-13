exports.up = async function (knex) {
  await knex.schema.createTable('sales', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('attendant_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.uuid('customer_id').nullable().references('id').inTable('customers').onDelete('SET NULL');
    table.decimal('total_amount', 15, 2).notNullable();
    table.decimal('discount', 15, 2).defaultTo(0);
    table.decimal('profit', 15, 2).defaultTo(0);
    table.string('customer_name', 255).nullable();
    table.string('status', 20).defaultTo('completed');
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['business_id', 'created_at']);
    table.index(['business_id', 'status']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('sales');
};
