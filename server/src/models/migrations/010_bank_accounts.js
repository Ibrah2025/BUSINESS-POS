exports.up = async function (knex) {
  await knex.schema.createTable('bank_accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('bank_name', 100).notNullable();
    table.string('account_name', 255).nullable();
    table.string('account_number', 20).nullable();
    table.string('account_type', 20).defaultTo('bank');
    table.decimal('balance', 15, 2).defaultTo(0);
    table.integer('usage_count').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index(['business_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('bank_accounts');
};
