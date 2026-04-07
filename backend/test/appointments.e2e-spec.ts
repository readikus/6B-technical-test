import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import Knex from 'knex';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as path from 'path';
import { AppModule } from '../src/app.module';

describe('Appointments API (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof Knex>;
  let authCookie: string[];

  const connectionBase = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'sixbee',
    password: process.env.POSTGRES_PASSWORD || 'changeme',
  };

  const testDb = 'sixbee_health_test';

  const validAppointment = {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+447700900000',
    description: 'Annual health check-up',
    date_time: '2026-12-15T10:00:00.000Z',
  };

  const adminCredentials = {
    email: 'appt-test@test.com',
    password: 'test-password-123',
  };

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.POSTGRES_DB = testDb;
    process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-bytes-long';
    process.env.LOGIN_THROTTLE_LIMIT = '10000';
    process.env.COOKIE_SECURE = 'false';
    process.env.THROTTLE_LIMIT = '10000';

    // Create test database if it doesn't exist
    const adminDb = Knex({
      client: 'pg',
      connection: { ...connectionBase, database: 'postgres' },
    });
    const result = await adminDb.raw(
      'SELECT 1 FROM pg_database WHERE datname = ?',
      [testDb],
    );
    if (result.rows.length === 0) {
      await adminDb.raw(`CREATE DATABASE "${testDb}"`);
    }
    await adminDb.destroy();

    // Connect to test database and run migrations
    db = Knex({
      client: 'pg',
      connection: { ...connectionBase, database: testDb },
    });
    await db.migrate.latest({
      directory: path.join(__dirname, '../migrations'),
    });

    // Boot NestJS application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.use(cookieParser());
    app.enableCors({ origin: ['http://localhost:3000'], credentials: true });
    app.setGlobalPrefix('api');
    await app.init();

    // Seed admin user and obtain auth cookie
    const hashedPassword = await bcrypt.hash(adminCredentials.password, 10);
    await db('admin_users')
      .insert({ email: adminCredentials.email, password: hashedPassword })
      .onConflict('email')
      .ignore();

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(adminCredentials);
    const cookies = loginRes.headers['set-cookie'];
    authCookie = Array.isArray(cookies) ? cookies : [cookies];
  }, 30_000);

  afterAll(async () => {
    if (db) {
      await db('admin_users').where({ email: adminCredentials.email }).del();
    }
    await app?.close();
    await db?.destroy();
  });

  beforeEach(async () => {
    await db.raw('TRUNCATE TABLE appointments CASCADE');
  });

  // ── POST /appointments ───────────────────────────────────────────

  describe('POST /appointments', () => {
    it('creates an appointment and returns 201 with the appointment data', async () => {
      // Arrange
      const payload = { ...validAppointment };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(payload);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        description: payload.description,
        status: 'pending',
      });
      expect(response.body.date_time).toBeDefined();
      expect(response.body.created_at).toBeDefined();
      expect(response.body.updated_at).toBeDefined();
    });

    it('stores PII fields encrypted in the database', async () => {
      // Arrange
      const payload = { ...validAppointment };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(payload);
      const row = await db('appointments')
        .where('id', response.body.id)
        .first();

      // Assert — raw DB values must NOT match plaintext (they are encrypted)
      expect(row.name).not.toBe(payload.name);
      expect(row.email).not.toBe(payload.email);
      expect(row.phone).not.toBe(payload.phone);
      expect(row.description).not.toBe(payload.description);
    });

    it('returns 400 when required fields are missing', async () => {
      // Arrange
      const payload = {};

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(payload);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBeDefined();
    });

    it('returns 400 for invalid email format', async () => {
      // Arrange
      const payload = { ...validAppointment, email: 'not-an-email' };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(payload);

      // Assert
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid phone format', async () => {
      // Arrange
      const payload = { ...validAppointment, phone: 'abc' };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(payload);

      // Assert
      expect(response.status).toBe(400);
    });

    it('returns 400 when name contains HTML tags (XSS prevention)', async () => {
      // Arrange
      const payload = {
        ...validAppointment,
        name: '<script>alert("xss")</script>',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(payload);

      // Assert
      expect(response.status).toBe(400);
    });

    it('returns 400 when description contains HTML tags (XSS prevention)', async () => {
      // Arrange
      const payload = {
        ...validAppointment,
        description: '<img src=x onerror=alert(1)>',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(payload);

      // Assert
      expect(response.status).toBe(400);
    });

    it('safely handles SQL injection attempts via parameterised queries', async () => {
      // Arrange — SQL injection payload that does NOT contain HTML tags
      const sqlInjection = "Robert'); DROP TABLE appointments;--";
      const payload = { ...validAppointment, description: sqlInjection };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(payload);

      // Assert — request succeeds; Knex parameterised queries treat it as data
      expect(response.status).toBe(201);
      expect(response.body.description).toBe(sqlInjection);

      // The table still exists (DROP TABLE did not execute)
      const tableExists = await db.schema.hasTable('appointments');
      expect(tableExists).toBe(true);
    });
  });

  // ── GET /appointments ────────────────────────────────────────────

  describe('GET /appointments', () => {
    it('returns an empty array when no appointments exist', async () => {
      // Arrange — table is truncated in beforeEach

      // Act
      const response = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Cookie', authCookie);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('returns all appointments with decrypted PII', async () => {
      // Arrange — create two appointments via the API
      await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);
      await request(app.getHttpServer())
        .post('/api/appointments')
        .send({
          ...validAppointment,
          name: 'John Doe',
          email: 'john@example.com',
        });

      // Act
      const response = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Cookie', authCookie);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      const names = response.body.map((a: { name: string }) => a.name);
      expect(names).toContain('Jane Smith');
      expect(names).toContain('John Doe');
    });
  });

  // ── GET /appointments/:id ────────────────────────────────────────

  describe('GET /appointments/:id', () => {
    it('returns a single appointment with decrypted PII', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const response = await request(app.getHttpServer())
        .get(`/api/appointments/${created.body.id}`)
        .set('Cookie', authCookie);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe(validAppointment.name);
      expect(response.body.email).toBe(validAppointment.email);
      expect(response.body.phone).toBe(validAppointment.phone);
      expect(response.body.description).toBe(validAppointment.description);
    });

    it('returns 404 for a non-existent UUID', async () => {
      // Arrange
      const fakeId = '00000000-0000-0000-0000-000000000000';

      // Act
      const response = await request(app.getHttpServer())
        .get(`/api/appointments/${fakeId}`)
        .set('Cookie', authCookie);

      // Assert
      expect(response.status).toBe(404);
    });

    it('returns 400 for an invalid UUID format', async () => {
      // Arrange / Act
      const response = await request(app.getHttpServer())
        .get('/api/appointments/not-a-uuid')
        .set('Cookie', authCookie);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  // ── PATCH /appointments/:id ──────────────────────────────────────

  describe('PATCH /appointments/:id', () => {
    it('partially updates appointment fields', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const response = await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Cookie', authCookie)
        .send({ name: 'Updated Name', status: 'confirmed' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.status).toBe('confirmed');
      expect(response.body.email).toBe(validAppointment.email);
    });

    it('re-encrypts updated PII fields in the database', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);
      const originalRow = await db('appointments')
        .where('id', created.body.id)
        .first();

      // Act
      await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Cookie', authCookie)
        .send({ name: 'Updated Name' });
      const updatedRow = await db('appointments')
        .where('id', created.body.id)
        .first();

      // Assert — encrypted name changed and is not plaintext
      expect(updatedRow.name).not.toBe(originalRow.name);
      expect(updatedRow.name).not.toBe('Updated Name');
    });

    it('returns 404 for a non-existent appointment', async () => {
      // Arrange
      const fakeId = '00000000-0000-0000-0000-000000000000';

      // Act
      const response = await request(app.getHttpServer())
        .patch(`/api/appointments/${fakeId}`)
        .set('Cookie', authCookie)
        .send({ name: 'Updated Name' });

      // Assert
      expect(response.status).toBe(404);
    });

    it('validates email format on update', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const response = await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Cookie', authCookie)
        .send({ email: 'not-valid' });

      // Assert
      expect(response.status).toBe(400);
    });
  });

  // ── DELETE /appointments/:id ─────────────────────────────────────

  describe('DELETE /appointments/:id', () => {
    it('deletes an appointment and returns 204', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const response = await request(app.getHttpServer())
        .delete(`/api/appointments/${created.body.id}`)
        .set('Cookie', authCookie);

      // Assert
      expect(response.status).toBe(204);
    });

    it('returns 404 for a non-existent appointment', async () => {
      // Arrange
      const fakeId = '00000000-0000-0000-0000-000000000000';

      // Act
      const response = await request(app.getHttpServer())
        .delete(`/api/appointments/${fakeId}`)
        .set('Cookie', authCookie);

      // Assert
      expect(response.status).toBe(404);
    });

    it('confirms the appointment no longer exists after deletion', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);
      await request(app.getHttpServer())
        .delete(`/api/appointments/${created.body.id}`)
        .set('Cookie', authCookie);

      // Act
      const getResponse = await request(app.getHttpServer())
        .get(`/api/appointments/${created.body.id}`)
        .set('Cookie', authCookie);

      // Assert — gone from both API and database
      expect(getResponse.status).toBe(404);
      const row = await db('appointments').where('id', created.body.id).first();
      expect(row).toBeUndefined();
    });
  });

  // ── Security ─────────────────────────────────────────────────────

  describe('Security', () => {
    it('includes Helmet security headers in responses', async () => {
      // Arrange / Act
      const response = await request(app.getHttpServer()).get('/');

      // Assert — Helmet sets several headers by default
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('returns CORS headers for the frontend origin', async () => {
      // Arrange / Act
      const response = await request(app.getHttpServer())
        .options('/api/appointments')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      // Assert
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
