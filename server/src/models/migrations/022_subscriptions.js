exports.up = async function (knex) {
  // Add plan fields to businesses table
  await knex.schema.alterTable('businesses', (table) => {
    table.string('plan', 20).defaultTo('free').notNullable();      // 'free' | 'premium'
    table.timestamp('plan_expires_at').nullable();                   // null = free forever
    table.string('plan_pin_used', 20).nullable();                   // last PIN redeemed
  });

  // Subscription PINs — pre-generated, sold by agents like recharge cards
  await knex.schema.createTable('subscription_pins', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('pin', 20).notNullable().unique();                 // e.g. "BIZPOS-XXXX-XXXX"
    table.integer('days').notNullable().defaultTo(30);               // duration in days
    table.string('plan_type', 20).notNullable().defaultTo('premium');
    table.string('status', 20).notNullable().defaultTo('unused');    // 'unused' | 'used' | 'expired'
    table.uuid('redeemed_by').nullable()
      .references('id').inTable('businesses').onDelete('SET NULL');
    table.timestamp('redeemed_at').nullable();
    table.string('batch_id', 50).nullable();                         // for agent tracking
    table.string('agent_name', 100).nullable();                      // who sold/distributed
    table.string('agent_phone', 20).nullable();
    table.decimal('price', 10, 2).nullable();                        // face value in Naira
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['status']);
    table.index(['batch_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('subscription_pins');
  await knex.schema.alterTable('businesses', (table) => {
    table.dropColumn('plan');
    table.dropColumn('plan_expires_at');
    table.dropColumn('plan_pin_used');
  });
};
