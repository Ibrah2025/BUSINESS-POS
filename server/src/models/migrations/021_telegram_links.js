exports.up = async function (knex) {
  await knex.schema.createTable('telegram_links', (table) => {
    table.string('chat_id', 50).primary();
    table.uuid('business_id').notNullable().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('user_name', 100).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index(['business_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('telegram_links');
};
