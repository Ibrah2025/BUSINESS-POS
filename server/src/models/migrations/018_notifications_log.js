exports.up = async function (knex) {
  await knex.schema.createTable('notifications_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('channel', 20).notNullable();
    table.text('message').notNullable();
    table.string('status', 20).defaultTo('sent');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['business_id', 'created_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('notifications_log');
};
