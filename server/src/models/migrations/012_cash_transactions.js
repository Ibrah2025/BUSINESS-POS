exports.up = async function (knex) {
  await knex.schema.createTable('cash_transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('type', 20).notNullable();
    table.decimal('amount', 15, 2).notNullable();
    table.text('description').nullable();
    table.decimal('balance_after', 15, 2).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['business_id', 'created_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('cash_transactions');
};
