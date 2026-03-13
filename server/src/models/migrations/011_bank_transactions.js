exports.up = async function (knex) {
  await knex.schema.createTable('bank_transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('bank_account_id').notNullable().references('id').inTable('bank_accounts').onDelete('CASCADE');
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('type', 20).notNullable();
    table.decimal('amount', 15, 2).notNullable();
    table.uuid('reference_id').nullable();
    table.text('description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['business_id', 'created_at']);
    table.index(['bank_account_id', 'created_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('bank_transactions');
};
