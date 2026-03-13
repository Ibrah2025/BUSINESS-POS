exports.up = async function (knex) {
  // Add refresh_token_hash to users for token rotation
  await knex.schema.alterTable('users', (table) => {
    table.string('refresh_token_hash', 64).nullable();
  });

  // Add ip_address and description to action_history for audit logging
  await knex.schema.alterTable('action_history', (table) => {
    table.string('ip_address', 45).nullable();
    table.string('description', 500).nullable();
    table.string('entity_type', 50).nullable();
  });

  // Make data and reverse_data nullable for audit entries
  await knex.raw('ALTER TABLE action_history ALTER COLUMN data DROP NOT NULL');
  await knex.raw('ALTER TABLE action_history ALTER COLUMN reverse_data DROP NOT NULL');
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('refresh_token_hash');
  });

  await knex.schema.alterTable('action_history', (table) => {
    table.dropColumn('ip_address');
    table.dropColumn('description');
    table.dropColumn('entity_type');
  });

  await knex.raw("UPDATE action_history SET data = '{}' WHERE data IS NULL");
  await knex.raw("UPDATE action_history SET reverse_data = '{}' WHERE reverse_data IS NULL");
  await knex.raw('ALTER TABLE action_history ALTER COLUMN data SET NOT NULL');
  await knex.raw('ALTER TABLE action_history ALTER COLUMN reverse_data SET NOT NULL');
};
