exports.up = async function (knex) {
  await knex.schema.alterTable('sale_payments', (table) => {
    table.foreign('bank_account_id').references('id').inTable('bank_accounts').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('sale_payments', (table) => {
    table.dropForeign('bank_account_id');
  });
};
