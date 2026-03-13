exports.up = async function (knex) {
  await knex.schema.createTable('sale_payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('sale_id').notNullable().references('id').inTable('sales').onDelete('CASCADE');
    table.string('method', 20).notNullable();
    table.decimal('amount', 15, 2).notNullable();
    table.uuid('bank_account_id').nullable();
    table.uuid('credit_id').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('sale_payments');
};
