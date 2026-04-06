import Knex from 'knex';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { AppointmentsRepository } from './appointments.repository';

const TEST_DB = 'sixbee_health_test';

const connectionBase = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'sixbee',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
};

const sampleData = {
  name: 'encrypted-name',
  email: 'encrypted-email',
  phone: 'encrypted-phone',
  description: 'encrypted-desc',
  date_time: '2026-12-15T10:00:00.000Z',
};

describe('AppointmentsRepository', () => {
  let db: ReturnType<typeof Knex>;
  let repo: AppointmentsRepository;

  beforeAll(async () => {
    const adminDb = Knex({
      client: 'pg',
      connection: { ...connectionBase, database: 'postgres' },
    });
    const result = await adminDb.raw(
      'SELECT 1 FROM pg_database WHERE datname = ?',
      [TEST_DB],
    );
    if (result.rows.length === 0) {
      await adminDb.raw(`CREATE DATABASE "${TEST_DB}"`);
    }
    await adminDb.destroy();

    db = Knex({
      client: 'pg',
      connection: { ...connectionBase, database: TEST_DB },
    });
    await db.migrate.latest({
      directory: path.join(__dirname, '../../migrations'),
    });

    repo = new AppointmentsRepository(db as any);
  }, 30_000);

  afterAll(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db.raw('TRUNCATE TABLE appointments CASCADE');
  });

  // ── insert ───────────────────────────────────────────────────────

  describe('insert', () => {
    it('inserts a row and returns it with an id', async () => {
      // Arrange / Act
      const row = await repo.insert(sampleData);

      // Assert
      expect(row.id).toBeDefined();
      expect(row.name).toBe(sampleData.name);
      expect(row.status).toBe('pending');
      expect(row.created_at).toBeDefined();
    });
  });

  // ── findAll ──────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns an empty array when no rows exist', async () => {
      // Arrange / Act
      const rows = await repo.findAll();

      // Assert
      expect(rows).toEqual([]);
    });

    it('returns all rows ordered by created_at desc', async () => {
      // Arrange
      await repo.insert(sampleData);
      await repo.insert({ ...sampleData, name: 'second' });

      // Act
      const rows = await repo.findAll();

      // Assert
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('second');
    });
  });

  // ── findById ─────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns a single row by id', async () => {
      // Arrange
      const inserted = await repo.insert(sampleData);

      // Act
      const row = await repo.findById(inserted.id);

      // Assert
      expect(row.id).toBe(inserted.id);
      expect(row.name).toBe(sampleData.name);
    });

    it('throws NotFoundException for a non-existent id', async () => {
      // Arrange / Act / Assert
      await expect(
        repo.findById('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ───────────────────────────────────────────────────────

  describe('update', () => {
    it('updates specified fields and returns the full row', async () => {
      // Arrange
      const inserted = await repo.insert(sampleData);

      // Act
      const row = await repo.update(inserted.id, {
        name: 'updated-name',
        status: 'confirmed',
      });

      // Assert
      expect(row.name).toBe('updated-name');
      expect(row.status).toBe('confirmed');
      expect(row.email).toBe(sampleData.email);
    });

    it('throws NotFoundException for a non-existent id', async () => {
      // Arrange / Act / Assert
      await expect(
        repo.update('00000000-0000-0000-0000-000000000000', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ───────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes the row', async () => {
      // Arrange
      const inserted = await repo.insert(sampleData);

      // Act
      await repo.remove(inserted.id);

      // Assert
      const row = await db('appointments').where('id', inserted.id).first();
      expect(row).toBeUndefined();
    });

    it('throws NotFoundException for a non-existent id', async () => {
      // Arrange / Act / Assert
      await expect(
        repo.remove('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
