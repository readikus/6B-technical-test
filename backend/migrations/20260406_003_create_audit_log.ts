import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('appointment_id')
      .nullable()
      .references('id')
      .inTable('appointments')
      .onDelete('SET NULL');
    table
      .uuid('admin_user_id')
      .notNullable()
      .references('id')
      .inTable('admin_users')
      .onDelete('RESTRICT');
    table.string('action').notNullable();
    table.text('changes').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_log');
}
