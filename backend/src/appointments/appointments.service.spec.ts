import Knex from 'knex';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EncryptionService } from '../encryption/encryption.service';
import { AppointmentsRepository } from './appointments.repository';
import { AppointmentsService } from './appointments.service';
import { APPOINTMENT_AUDIT } from '../audit/audit.events';

const TEST_DB = 'sixbee_health_test';
const ENCRYPTION_KEY = 'a'.repeat(64);

const connectionBase = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'sixbee',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
};

const validDto = {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  phone: '+447700900000',
  description: 'Annual health check-up',
  date_time: '2026-12-15T10:00:00.000Z',
};

describe('AppointmentsService', () => {
  let db: ReturnType<typeof Knex>;
  let repo: AppointmentsRepository;
  let encryption: EncryptionService;
  let eventEmitter: EventEmitter2;
  let service: AppointmentsService;

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
    encryption = new EncryptionService(ENCRYPTION_KEY);
    eventEmitter = new EventEmitter2();
    service = new AppointmentsService(repo, encryption, eventEmitter);
  }, 30_000);

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.raw('TRUNCATE TABLE appointments CASCADE');
  });

  // ── create ───────────────────────────────────────────────────────

  describe('create', () => {
    it('returns the appointment with decrypted PII fields', async () => {
      // Arrange / Act
      const result = await service.create(validDto);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.name).toBe(validDto.name);
      expect(result.email).toBe(validDto.email);
      expect(result.phone).toBe(validDto.phone);
      expect(result.description).toBe(validDto.description);
      expect(result.status).toBe('pending');
    });

    it('stores PII fields encrypted in the database', async () => {
      // Arrange / Act
      const result = await service.create(validDto);
      const row = await db('appointments').where('id', result.id).first();

      // Assert — raw values are NOT plaintext
      expect(row.name).not.toBe(validDto.name);
      expect(row.email).not.toBe(validDto.email);
      expect(row.phone).not.toBe(validDto.phone);
      expect(row.description).not.toBe(validDto.description);
    });

    it('stores non-PII fields as-is', async () => {
      // Arrange / Act
      const result = await service.create(validDto);
      const row = await db('appointments').where('id', result.id).first();

      // Assert — status and date_time are not encrypted
      expect(row.status).toBe('pending');
      expect(new Date(row.date_time).toISOString()).toBe(validDto.date_time);
    });

    it('handles SQL injection strings safely as literal data', async () => {
      // Arrange
      const sqlInjection = "Robert'); DROP TABLE appointments;--";
      const dto = { ...validDto, description: sqlInjection };

      // Act
      const result = await service.create(dto);

      // Assert — stored and returned as a literal string
      expect(result.description).toBe(sqlInjection);
      const tableExists = await db.schema.hasTable('appointments');
      expect(tableExists).toBe(true);
    });
  });

  // ── findAll ──────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns an empty array when no appointments exist', async () => {
      // Arrange (table truncated in beforeEach)

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([]);
    });

    it('returns all appointments with decrypted PII', async () => {
      // Arrange
      await service.create(validDto);
      await service.create({
        ...validDto,
        name: 'John Doe',
        email: 'john@example.com',
      });

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(2);
      const names = result.map((a) => a.name);
      expect(names).toContain('Jane Smith');
      expect(names).toContain('John Doe');
    });
  });

  // ── findOne ──────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns a single appointment with decrypted PII', async () => {
      // Arrange
      const created = await service.create(validDto);

      // Act
      const result = await service.findOne(created.id);

      // Assert
      expect(result.name).toBe(validDto.name);
      expect(result.email).toBe(validDto.email);
    });

    it('throws NotFoundException for a non-existent UUID', async () => {
      // Arrange
      const fakeId = '00000000-0000-0000-0000-000000000000';

      // Act / Assert
      await expect(service.findOne(fakeId)).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ───────────────────────────────────────────────────────

  describe('update', () => {
    it('partially updates and returns the full appointment', async () => {
      // Arrange
      const created = await service.create(validDto);

      // Act
      const result = await service.update(created.id, {
        name: 'Updated Name',
        status: 'confirmed',
      });

      // Assert
      expect(result.name).toBe('Updated Name');
      expect(result.status).toBe('confirmed');
      expect(result.email).toBe(validDto.email);
    });

    it('re-encrypts updated PII fields with a new ciphertext', async () => {
      // Arrange
      const created = await service.create(validDto);
      const originalRow = await db('appointments')
        .where('id', created.id)
        .first();

      // Act
      await service.update(created.id, { name: 'Updated Name' });
      const updatedRow = await db('appointments')
        .where('id', created.id)
        .first();

      // Assert
      expect(updatedRow.name).not.toBe(originalRow.name);
      expect(updatedRow.name).not.toBe('Updated Name');
    });

    it('throws NotFoundException for a non-existent UUID', async () => {
      // Arrange
      const fakeId = '00000000-0000-0000-0000-000000000000';

      // Act / Assert
      await expect(service.update(fakeId, { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── remove ───────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes an existing appointment', async () => {
      // Arrange
      const created = await service.create(validDto);

      // Act
      await service.remove(created.id);

      // Assert
      const row = await db('appointments').where('id', created.id).first();
      expect(row).toBeUndefined();
    });

    it('throws NotFoundException for a non-existent UUID', async () => {
      // Arrange
      const fakeId = '00000000-0000-0000-0000-000000000000';

      // Act / Assert
      await expect(service.remove(fakeId)).rejects.toThrow(NotFoundException);
    });
  });

  // ── event emission ───────────────────────────────────────────────

  describe('event emission', () => {
    it('emits an audit event after creating an appointment', async () => {
      // Arrange
      const emitted: unknown[] = [];
      eventEmitter.on(APPOINTMENT_AUDIT, (event) => emitted.push(event));

      // Act
      await service.create(validDto);

      // Assert
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        action: 'created',
        appointmentId: expect.any(String),
        changes: validDto,
      });
    });

    it('emits an audit event after updating an appointment', async () => {
      // Arrange
      const created = await service.create(validDto);
      const emitted: unknown[] = [];
      eventEmitter.on(APPOINTMENT_AUDIT, (event) => emitted.push(event));

      // Act
      const updateDto = { name: 'Updated Name' };
      await service.update(created.id, updateDto);

      // Assert
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        action: 'updated',
        appointmentId: created.id,
        changes: updateDto,
      });
    });

    it('emits an audit event after deleting an appointment', async () => {
      // Arrange
      const created = await service.create(validDto);
      const emitted: unknown[] = [];
      eventEmitter.on(APPOINTMENT_AUDIT, (event) => emitted.push(event));

      // Act
      await service.remove(created.id);

      // Assert
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        action: 'deleted',
        appointmentId: created.id,
        changes: {},
      });
    });
  });
});
