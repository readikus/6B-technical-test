import Knex from 'knex';
import * as path from 'path';
import { EncryptionService } from '../encryption/encryption.service';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

const TEST_DB = 'sixbee_health_test';
const ENCRYPTION_KEY = 'a'.repeat(64);

const connectionBase = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'sixbee',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
};

describe('AuditService', () => {
  let db: ReturnType<typeof Knex>;
  let encryption: EncryptionService;
  let service: AuditService;
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

    encryption = new EncryptionService(ENCRYPTION_KEY);
    const repo = new AuditRepository(db as any);
    service = new AuditService(repo, encryption);
  }, 30_000);

  afterAll(async () => {
    await db.destroy();
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

  // ── log ──────────────────────────────────────────────────────────

  describe('log', () => {
    it('creates an audit record with encrypted changes', async () => {
      // Arrange
      const changes = { name: 'Jane Smith' };

      // Act
      await service.log('created', appointmentId, changes);

      // Assert — raw DB value is encrypted
      const row = await db('audit_log').first();
      expect(row.action).toBe('created');
      expect(row.changes).not.toBe(JSON.stringify(changes));

      // Decrypted value matches the original
      const decrypted = JSON.parse(encryption.decrypt(row.changes));
      expect(decrypted).toEqual(changes);
    });

    it('stores null appointment_id for delete actions', async () => {
      // Arrange / Act
      await service.log('deleted', appointmentId, {});

      // Assert
      const row = await db('audit_log').first();
      expect(row.appointment_id).toBeNull();
    });

    it('stores the appointment_id for create and update actions', async () => {
      // Arrange / Act
      await service.log('created', appointmentId, {});

      // Assert
      const row = await db('audit_log').first();
      expect(row.appointment_id).toBe(appointmentId);
    });
  });

  // ── findAll ──────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all audit records with decrypted changes', async () => {
      // Arrange
      await service.log('created', appointmentId, { name: 'Jane' });
      await service.log('updated', appointmentId, { name: 'Updated' });

      // Act
      const rows = await service.findAll();

      // Assert
      expect(rows).toHaveLength(2);
      expect(rows[0].changes).toEqual({ name: 'Updated' });
      expect(rows[1].changes).toEqual({ name: 'Jane' });
    });
  });

  // ── findByAppointmentId ──────────────────────────────────────────

  describe('findByAppointmentId', () => {
    it('returns audit records for a specific appointment with decrypted changes', async () => {
      // Arrange
      await service.log('created', appointmentId, { name: 'Jane' });

      // Act
      const rows = await service.findByAppointmentId(appointmentId);

      // Assert
      expect(rows).toHaveLength(1);
      expect(rows[0].changes).toEqual({ name: 'Jane' });
      expect(rows[0].action).toBe('created');
    });
  });
});
