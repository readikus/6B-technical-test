import Knex from 'knex';
import * as path from 'path';
import { AuditRepository } from './audit.repository';

const TEST_DB = 'sixbee_health_test';

const connectionBase = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'sixbee',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
};

describe('AuditRepository', () => {
  let db: ReturnType<typeof Knex>;
  let repo: AuditRepository;
  let appointmentId: string;

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

    repo = new AuditRepository(db as any);
  }, 30_000);

  afterAll(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db.raw('TRUNCATE TABLE audit_log CASCADE');
    await db.raw('TRUNCATE TABLE appointments CASCADE');

    const [row] = await db('appointments')
      .insert({
        name: 'test',
        email: 'test',
        phone: 'test',
        description: 'test',
        date_time: new Date().toISOString(),
      })
      .returning('id');
    appointmentId = row.id;
  });

  // ── insert ───────────────────────────────────────────────────────

  describe('insert', () => {
    it('inserts an audit record and returns it with an id', async () => {
      // Arrange / Act
      const row = await repo.insert({
        appointment_id: appointmentId,
        action: 'created',
        changes: 'encrypted-blob',
      });

      // Assert
      expect(row.id).toBeDefined();
      expect(row.action).toBe('created');
      expect(row.appointment_id).toBe(appointmentId);
      expect(row.created_at).toBeDefined();
    });

    it('allows null appointment_id', async () => {
      // Arrange / Act
      const row = await repo.insert({
        appointment_id: null,
        action: 'deleted',
        changes: 'encrypted-blob',
      });

      // Assert
      expect(row.appointment_id).toBeNull();
    });
  });

  // ── findAll ──────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns an empty array when no records exist', async () => {
      // Arrange / Act
      const rows = await repo.findAll();

      // Assert
      expect(rows).toEqual([]);
    });

    it('returns all records ordered by created_at desc', async () => {
      // Arrange
      await repo.insert({
        appointment_id: appointmentId,
        action: 'created',
        changes: 'first',
      });
      await repo.insert({
        appointment_id: appointmentId,
        action: 'updated',
        changes: 'second',
      });

      // Act
      const rows = await repo.findAll();

      // Assert
      expect(rows).toHaveLength(2);
      expect(rows[0].action).toBe('updated');
    });
  });

  // ── findByAppointmentId ──────────────────────────────────────────

  describe('findByAppointmentId', () => {
    it('returns audit records for a specific appointment', async () => {
      // Arrange
      await repo.insert({
        appointment_id: appointmentId,
        action: 'created',
        changes: 'blob',
      });
      await repo.insert({
        appointment_id: null,
        action: 'deleted',
        changes: 'blob',
      });

      // Act
      const rows = await repo.findByAppointmentId(appointmentId);

      // Assert
      expect(rows).toHaveLength(1);
      expect(rows[0].appointment_id).toBe(appointmentId);
    });

    it('returns an empty array when no records match', async () => {
      // Arrange / Act
      const rows = await repo.findByAppointmentId(
        '00000000-0000-0000-0000-000000000000',
      );

      // Assert
      expect(rows).toEqual([]);
    });
  });
});
