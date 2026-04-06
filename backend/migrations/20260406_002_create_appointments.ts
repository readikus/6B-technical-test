import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('appointments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.text('name').notNullable();
    table.text('email').notNullable();
    table.text('phone').notNullable();
    table.text('description').notNullable();
    table.timestamp('date_time').notNullable();
    table.string('status').notNullable().defaultTo('pending');
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('appointments');
}
