exports.up = async function (knex) {
  await knex.schema.createTable('settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('business_id')
      .unique()
      .references('id')
      .inTable('businesses')
      .onDelete('CASCADE');
    table.string('theme', 50).defaultTo('premium');
    table.string('language', 10).defaultTo('en');
    table.boolean('sound_enabled').defaultTo(true);
    table.boolean('haptic_enabled').defaultTo(true);
    table.boolean('auto_process_bank').defaultTo(false);
    table.integer('low_stock_threshold_default').defaultTo(10);
    table.boolean('data_saver_mode').defaultTo(false);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('settings');
};
