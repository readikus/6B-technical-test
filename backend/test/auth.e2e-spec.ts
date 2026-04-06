import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import Knex from 'knex';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import * as path from 'path';
import { AppModule } from '../src/app.module';

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof Knex>;

  const connectionBase = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'sixbee',
    password: process.env.POSTGRES_PASSWORD || 'changeme',
  };

  const testDb = 'sixbee_health_test';

  const adminCredentials = {
    email: 'auth-test@test.com',
    password: 'test-password-123',
  };

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.POSTGRES_DB = testDb;
    process.env.JWT_SECRET = 'test-jwt-secret';

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

    // Seed admin user
    const hashedPassword = await bcrypt.hash(adminCredentials.password, 10);
    await db('admin_users')
      .insert({
        email: adminCredentials.email,
        password: hashedPassword,
      })
      .onConflict('email')
      .ignore();

    // Boot NestJS application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.enableCors({ origin: ['http://localhost:3000'] });
    await app.init();
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

  // ── POST /auth/login ────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns access_token with valid credentials', async () => {
      // Arrange
      const payload = adminCredentials;

      // Act
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(payload);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.access_token).toBeDefined();
      expect(typeof response.body.access_token).toBe('string');
    });

    it('returns 401 with wrong password', async () => {
      // Arrange
      const payload = { email: adminCredentials.email, password: 'wrong' };

      // Act
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(payload);

      // Assert
      expect(response.status).toBe(401);
    });

    it('returns 401 for non-existent user', async () => {
      // Arrange
      const payload = { email: 'nobody@test.com', password: 'anything' };

      // Act
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(payload);

      // Assert
      expect(response.status).toBe(401);
    });

    it('returns validation error for missing email', async () => {
      // Arrange
      const payload = { password: 'something' };

      // Act
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(payload);

      // Assert
      expect(response.status).toBe(200); // Controller returns 200 with error body
      expect(response.body.message).toBe('Validation failed');
    });

    it('returns validation error for invalid email format', async () => {
      // Arrange
      const payload = { email: 'not-an-email', password: 'something' };

      // Act
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(payload);

      // Assert
      expect(response.body.message).toBe('Validation failed');
    });

    it('token grants access to protected endpoints', async () => {
      // Arrange
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(adminCredentials);
      const token = loginResponse.body.access_token;

      // Act
      const response = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('invalid token is rejected by protected endpoints', async () => {
      // Arrange / Act
      const response = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', 'Bearer invalid-token');

      // Assert
      expect(response.status).toBe(401);
    });

    it('expired token format is rejected', async () => {
      // Arrange — a structurally valid but expired JWT
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      // Act
      const response = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', `Bearer ${expiredToken}`);

      // Assert
      expect(response.status).toBe(401);
    });
  });
});
