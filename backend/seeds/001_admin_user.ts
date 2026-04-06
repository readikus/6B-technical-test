import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

export async function seed(knex: Knex): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
  }

  const existing = await knex('admin_users').where({ email }).first();
  if (existing) return;

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await knex('admin_users').insert({
    email,
    password: hashedPassword,
  });
}
