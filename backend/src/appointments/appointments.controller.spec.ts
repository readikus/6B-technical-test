import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import Knex from 'knex';
import * as path from 'path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentsRepository } from './appointments.repository';
import { EncryptionService } from '../encryption/encryption.service';
import { AuditService } from '../audit/audit.service';
import { AuditRepository } from '../audit/audit.repository';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KNEX_TOKEN } from '../database/database.module';

const TEST_DB = 'sixbee_health_test';
const ENCRYPTION_KEY = 'a'.repeat(64);

const connectionBase = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'sixbee',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
};

const validAppointment = {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  phone: '+447700900000',
  description: 'Annual health check-up',
  date_time: '2026-12-15T10:00:00.000Z',
};

describe('AppointmentsController', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof Knex>;

  beforeAll(async () => {
    // Create test database if needed
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

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-jwt-secret',
          signOptions: { expiresIn: '8h' },
        }),
      ],
      controllers: [AppointmentsController],
      providers: [
        AppointmentsService,
        AppointmentsRepository,
        AuditService,
        AuditRepository,
        { provide: KNEX_TOKEN, useValue: db },
        {
          provide: EncryptionService,
          useValue: new EncryptionService(ENCRYPTION_KEY),
        },
        { provide: EventEmitter2, useValue: new EventEmitter2() },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await db?.destroy();
  });

  beforeEach(async () => {
    await db.raw('TRUNCATE TABLE appointments CASCADE');
  });

  // ── POST /appointments ───────────────────────────────────────────

  describe('POST /appointments', () => {
    it('returns 201 for valid input', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Assert
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(validAppointment.name);
      expect(res.body.status).toBe('pending');
    });

    it('returns 400 when required fields are missing', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .post('/api/appointments')
        .send({});

      // Assert
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('returns 400 for invalid email', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .post('/api/appointments')
        .send({ ...validAppointment, email: 'not-an-email' });

      // Assert
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid phone', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .post('/api/appointments')
        .send({ ...validAppointment, phone: 'abc' });

      // Assert
      expect(res.status).toBe(400);
    });

    it('returns 400 for HTML tags in name (XSS)', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .post('/api/appointments')
        .send({ ...validAppointment, name: '<script>alert(1)</script>' });

      // Assert
      expect(res.status).toBe(400);
    });

    it('returns 400 for HTML tags in description (XSS)', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .post('/api/appointments')
        .send({
          ...validAppointment,
          description: '<img src=x onerror=alert(1)>',
        });

      // Assert
      expect(res.status).toBe(400);
    });
  });

  // ── GET /appointments ────────────────────────────────────────────

  describe('GET /appointments', () => {
    it('returns 200 with an empty array', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer()).get('/api/appointments');

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 200 with all appointments', async () => {
      // Arrange
      await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const res = await request(app.getHttpServer()).get('/api/appointments');

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe(validAppointment.name);
    });
  });

  // ── GET /appointments/:id ────────────────────────────────────────

  describe('GET /appointments/:id', () => {
    it('returns 200 for an existing appointment', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const res = await request(app.getHttpServer()).get(
        `/api/appointments/${created.body.id}`,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(validAppointment.name);
    });

    it('returns 404 for a non-existent UUID', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer()).get(
        '/api/appointments/00000000-0000-0000-0000-000000000000',
      );

      // Assert
      expect(res.status).toBe(404);
    });

    it('returns 400 for an invalid UUID format', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer()).get(
        '/api/appointments/not-a-uuid',
      );

      // Assert
      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /appointments/:id ──────────────────────────────────────

  describe('PATCH /appointments/:id', () => {
    it('returns 200 with the updated appointment', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const res = await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .send({ name: 'Updated Name' });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.email).toBe(validAppointment.email);
    });

    it('returns 404 for a non-existent UUID', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .patch('/api/appointments/00000000-0000-0000-0000-000000000000')
        .send({ name: 'Updated' });

      // Assert
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid email in update', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const res = await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .send({ email: 'bad' });

      // Assert
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid UUID format', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .patch('/api/appointments/not-valid')
        .send({ name: 'Test' });

      // Assert
      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /appointments/:id ─────────────────────────────────────

  describe('DELETE /appointments/:id', () => {
    it('returns 204 on successful deletion', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const res = await request(app.getHttpServer()).delete(
        `/api/appointments/${created.body.id}`,
      );

      // Assert
      expect(res.status).toBe(204);
    });

    it('returns 404 for a non-existent UUID', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer()).delete(
        '/api/appointments/00000000-0000-0000-0000-000000000000',
      );

      // Assert
      expect(res.status).toBe(404);
    });

    it('returns 400 for an invalid UUID format', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer()).delete(
        '/api/appointments/not-valid',
      );

      // Assert
      expect(res.status).toBe(400);
    });
  });
});
