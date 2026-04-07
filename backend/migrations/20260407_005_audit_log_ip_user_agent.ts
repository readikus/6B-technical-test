import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('audit_log', (table) => {
    table.string('ip_address', 45).nullable(); // 45 = max IPv6
    table.string('user_agent', 512).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('audit_log', (table) => {
    table.dropColumn('user_agent');
    table.dropColumn('ip_address');
  });
}
