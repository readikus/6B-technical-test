import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;

/**
 * Enforces a minimum password policy on the seeded admin password:
 * - At least 12 characters
 * - Mix of upper, lower, digit, and symbol
 *
 * This protects against the most common deployment mistake of leaving
 * the seed password as a default value.
 */
function assertStrongPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    );
  }
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  if (!(hasLower && hasUpper && hasDigit && hasSymbol)) {
    throw new Error(
      'ADMIN_PASSWORD must contain a mix of uppercase, lowercase, digits, and symbols',
    );
  }
}

export async function seed(knex: Knex): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required',
    );
  }

  assertStrongPassword(password);

  const existing = await knex('admin_users').where({ email }).first();
  if (existing) return;

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await knex('admin_users').insert({
    email,
    password: hashedPassword,
  });
}
