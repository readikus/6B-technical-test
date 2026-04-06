import Knex from 'knex';
import * as path from 'path';
import { EncryptionService } from '../encryption/encryption.service';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditListener } from './audit.listener';
import { AppointmentEvent } from './audit.events';

const TEST_DB = 'sixbee_health_test';
const ENCRYPTION_KEY = 'a'.repeat(64);

const connectionBase = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'sixbee',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
};

describe('AuditListener', () => {
  let db: ReturnType<typeof Knex>;
  let listener: AuditListener;
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

    const encryption = new EncryptionService(ENCRYPTION_KEY);
    const repo = new AuditRepository(db as any);
    const service = new AuditService(repo, encryption);
    listener = new AuditListener(service);
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

  it('writes an audit record when handling a created event', async () => {
    // Arrange
    const event = new AppointmentEvent('created', appointmentId, {
      name: 'Jane Smith',
    });

    // Act
    await listener.handleAppointmentAudit(event);

    // Assert
    const rows = await db('audit_log').select('*');
    expect(rows).toHaveLength(1);
    expect(rows[0].appointment_id).toBe(appointmentId);
    expect(rows[0].action).toBe('created');
  });

  it('writes an audit record with null appointment_id for delete events', async () => {
    // Arrange
    const event = new AppointmentEvent('deleted', appointmentId, {});

    // Act
    await listener.handleAppointmentAudit(event);

    // Assert
    const rows = await db('audit_log').select('*');
    expect(rows).toHaveLength(1);
    expect(rows[0].appointment_id).toBeNull();
    expect(rows[0].action).toBe('deleted');
  });

  it('encrypts the changes field', async () => {
    // Arrange
    const changes = { name: 'Jane Smith', email: 'jane@example.com' };
    const event = new AppointmentEvent('created', appointmentId, changes);

    // Act
    await listener.handleAppointmentAudit(event);

    // Assert
    const row = await db('audit_log').first();
    expect(row.changes).not.toBe(JSON.stringify(changes));
  });
});
