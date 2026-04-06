import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import Knex from 'knex';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import * as path from 'path';
import { AppModule } from '../src/app.module';

describe('Admin Actions (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof Knex>;
  let authToken: string;

  const connectionBase = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'sixbee',
    password: process.env.POSTGRES_PASSWORD || 'changeme',
  };

  const testDb = 'sixbee_health_test';

  const adminCredentials = {
    email: 'admin-actions-test@test.com',
    password: 'test-password-123',
  };

  const validAppointment = {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+447700900000',
    description: 'Annual health check-up',
    date_time: '2026-12-15T10:00:00.000Z',
  };

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.POSTGRES_DB = testDb;
    process.env.JWT_SECRET = 'test-jwt-secret';

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

    db = Knex({
      client: 'pg',
      connection: { ...connectionBase, database: testDb },
    });
    await db.migrate.latest({
      directory: path.join(__dirname, '../migrations'),
    });

    const hashedPassword = await bcrypt.hash(adminCredentials.password, 10);
    await db('admin_users')
      .insert({ email: adminCredentials.email, password: hashedPassword })
      .onConflict('email')
      .ignore();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.enableCors({ origin: ['http://localhost:3000'] });
    app.setGlobalPrefix('api');
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(adminCredentials);
    authToken = loginRes.body.access_token as string;
  }, 30_000);

  afterAll(async () => {
    if (db) {
      await db('admin_users').where({ email: adminCredentials.email }).del();
    }
    await app?.close();
    await db?.destroy();
  });

  beforeEach(async () => {
    await db.raw('TRUNCATE TABLE audit_log CASCADE');
    await db.raw('TRUNCATE TABLE appointments CASCADE');
  });

  // ── Approve (status toggle) ──────────────────────────────────────

  describe('Approve appointment', () => {
    it('changes status from pending to confirmed', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const response = await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'confirmed' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('confirmed');
    });

    it('creates an audit log entry for approval', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'confirmed' });

      // Allow async event listener to write the audit record
      await new Promise((r) => setTimeout(r, 100));

      // Assert
      const auditRes = await request(app.getHttpServer())
        .get(`/api/appointments/${created.body.id}/audit`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(auditRes.status).toBe(200);
      const approvalEntry = auditRes.body.find(
        (e: { action: string }) => e.action === 'approved',
      );
      expect(approvalEntry).toBeDefined();
      expect(approvalEntry.changes.status).toBeDefined();
    });
  });

  // ── Edit appointment ─────────────────────────────────────────────

  describe('Edit appointment', () => {
    it('updates appointment fields via PATCH', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const response = await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          description: 'Updated reason',
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.description).toBe('Updated reason');
      expect(response.body.email).toBe(validAppointment.email);
    });

    it('creates audit log with from/to changes', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' });

      await new Promise((r) => setTimeout(r, 100));

      // Assert
      const auditRes = await request(app.getHttpServer())
        .get(`/api/appointments/${created.body.id}/audit`)
        .set('Authorization', `Bearer ${authToken}`);

      const editEntry = auditRes.body.find(
        (e: { action: string }) => e.action === 'updated',
      );
      expect(editEntry).toBeDefined();
      expect(editEntry.changes.name.from).toBe('Jane Smith');
      expect(editEntry.changes.name.to).toBe('Updated Name');
    });

    it('records admin_user_id in audit log', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' });

      await new Promise((r) => setTimeout(r, 100));

      // Assert
      const auditRes = await request(app.getHttpServer())
        .get(`/api/appointments/${created.body.id}/audit`)
        .set('Authorization', `Bearer ${authToken}`);

      const editEntry = auditRes.body.find(
        (e: { action: string }) => e.action === 'updated',
      );
      expect(editEntry.admin_user_id).toBeDefined();
      expect(editEntry.admin_user_id).not.toBeNull();
    });
  });

  // ── Delete appointment ───────────────────────────────────────────

  describe('Delete appointment', () => {
    it('removes the appointment and returns 204', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const response = await request(app.getHttpServer())
        .delete(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert
      expect(response.status).toBe(204);

      const getRes = await request(app.getHttpServer())
        .get(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(getRes.status).toBe(404);
    });

    it('creates a deletion audit log entry', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      await request(app.getHttpServer())
        .delete(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert — audit log stored even though appointment is gone
      const rows = await db('audit_log')
        .where('action', 'deleted')
        .orderBy('created_at', 'desc');
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0].admin_user_id).not.toBeNull();
    });
  });

  // ── Audit log endpoint ───────────────────────────────────────────

  describe('GET /appointments/:id/audit', () => {
    it('returns audit history for an appointment', async () => {
      // Arrange — create, then approve, then edit
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'confirmed' });

      await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Edited Name' });

      await new Promise((r) => setTimeout(r, 100));

      // Act
      const auditRes = await request(app.getHttpServer())
        .get(`/api/appointments/${created.body.id}/audit`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert — should have created + approved + updated entries
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.length).toBeGreaterThanOrEqual(3);

      const actions = auditRes.body.map((e: { action: string }) => e.action);
      expect(actions).toContain('created');
      expect(actions).toContain('approved');
      expect(actions).toContain('updated');
    });

    it('requires authentication', async () => {
      // Arrange / Act
      const response = await request(app.getHttpServer()).get(
        '/api/appointments/00000000-0000-0000-0000-000000000000/audit',
      );

      // Assert
      expect(response.status).toBe(401);
    });
  });
});
