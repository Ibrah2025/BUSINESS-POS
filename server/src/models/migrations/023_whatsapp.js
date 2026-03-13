exports.up = async function (knex) {
  // Stores Baileys auth credentials + keys in DB (survives Render restarts)
  await knex.schema.createTable('whatsapp_auth_state', (table) => {
    table.string('key', 255).primary();
    table.jsonb('value').notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Per-business WhatsApp notification config
  await knex.schema.createTable('whatsapp_config', (table) => {
    table.uuid('business_id').primary().references('id').inTable('businesses').onDelete('CASCADE');
    table.string('recipient_phone', 30).nullable(); // e.g. "2348012345678"
    table.boolean('notify_sales').defaultTo(true);
    table.boolean('notify_low_stock').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('whatsapp_config');
  await knex.schema.dropTableIfExists('whatsapp_auth_state');
};
