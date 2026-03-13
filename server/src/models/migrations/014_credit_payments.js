exports.up = async function (knex) {
  await knex.schema.createTable('credit_payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('credit_id').notNullable().references('id').inTable('credits').onDelete('CASCADE');
    table.decimal('amount', 15, 2).notNullable();
    table.string('method', 20).notNullable();
    table
      .uuid('bank_account_id')
      .nullable()
      .references('id')
      .inTable('bank_accounts')
      .onDelete('SET NULL');
    table.timestamp('paid_at').defaultTo(knex.fn.now());
  });

  // Add FK from sale_payments.credit_id -> credits.id
  await knex.schema.alterTable('sale_payments', (table) => {
    table
      .foreign('credit_id')
      .references('id')
      .inTable('credits')
      .onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('sale_payments', (table) => {
    table.dropForeign('credit_id');
  });
  await knex.schema.dropTableIfExists('credit_payments');
};
