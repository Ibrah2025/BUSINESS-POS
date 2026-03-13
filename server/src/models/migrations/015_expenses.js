exports.up = async function (knex) {
  await knex.schema.createTable('expenses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('category', 50).notNullable();
    table.text('description').nullable();
    table.decimal('amount', 15, 2).notNullable();
    table.string('payment_method', 20).notNullable();
    table.uuid('bank_account_id').nullable().references('id').inTable('bank_accounts').onDelete('SET NULL');
    table.date('date').notNullable();
    table.boolean('is_recurring').defaultTo(false);
    table.string('recurrence_interval', 20).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['business_id', 'date']);
    table.index(['business_id', 'category']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('expenses');
};
