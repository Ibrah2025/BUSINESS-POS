exports.up = async function (knex) {
  await knex.schema.createTable('credits', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('customer_id').nullable().references('id').inTable('customers').onDelete('SET NULL');
    table.string('type', 10).notNullable();
    table.string('name', 255).notNullable();
    table.string('phone', 20).nullable();
    table.decimal('total_amount', 15, 2).notNullable();
    table.decimal('balance_remaining', 15, 2).notNullable();
    table.date('due_date').nullable();
    table.string('status', 20).defaultTo('pending');
    table.text('items_description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index(['business_id', 'status']);
    table.index(['business_id', 'type']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('credits');
};
