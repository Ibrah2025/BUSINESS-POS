exports.up = async function (knex) {
  await knex.schema.createTable('businesses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 255).notNullable();
    table.string('type', 100).notNullable();
    table.string('currency', 10).defaultTo('₦');
    table.text('logo_url').nullable();
    table
      .uuid('owner_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.jsonb('notification_prefs').defaultTo('{}');
    table.timestamps(true, true);
  });

  await knex.schema.alterTable('users', (table) => {
    table
      .foreign('business_id')
      .references('id')
      .inTable('businesses')
      .onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropForeign('business_id');
  });
  await knex.schema.dropTableIfExists('businesses');
};
