exports.up = async function (knex) {
  await knex.schema.createTable('customers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('phone', 20).nullable();
    table.decimal('credit_limit', 15, 2).defaultTo(0);
    table.decimal('total_purchases', 15, 2).defaultTo(0);
    table.timestamp('last_purchase_at').nullable();
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index(['business_id', 'phone']);
    table.index(['business_id', 'name']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('customers');
};
