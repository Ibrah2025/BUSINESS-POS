exports.up = async function (knex) {
  await knex.schema.createTable('action_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('action_type', 50).notNullable();
    table.jsonb('data').notNullable();
    table.jsonb('reverse_data').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['business_id', 'created_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('action_history');
};
