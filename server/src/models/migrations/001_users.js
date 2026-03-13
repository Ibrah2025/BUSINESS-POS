exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('business_id').nullable();
    table.string('name', 255).notNullable();
    table.string('phone', 20);
    table.string('email', 255);
    table.string('pin_hash', 255).notNullable();
    table
      .enu('role', ['owner', 'manager', 'attendant'])
      .defaultTo('attendant');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('users');
};
