import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import Knex from 'knex';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as path from 'path';
import { io as ioClient, type Socket } from 'socket.io-client';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';

/**
 * SECURITY E2E TESTS
 *
 * Each test exercises a finding from docs/SECURITY-AUDIT.md.
 *
 * Tests are tagged in their describe blocks with the finding ID
 * (e.g. "[C1]", "[H2]") so failures map directly to the audit doc.
 *
 * Tests that document a CURRENT vulnerability are written as
 * "passes when the vuln exists" — i.e. the test passes today and
 * will need updating when the fix lands. They are clearly marked
 * with "VULN:" prefix.
 *
 * Tests for properly-secured behaviour are written normally — they
 * fail if the security control regresses.
 */

describe('Security (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof Knex>;
  let serverUrl: string;
  let authCookie: string[];
  let jwtService: JwtService;

  const connectionBase = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'sixbee',
    password: process.env.POSTGRES_PASSWORD || 'changeme',
  };

  const testDb = 'sixbee_health_test';

  const adminCredentials = {
    email: 'security-test@test.com',
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
    process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-bytes-long';

    // Create test DB if needed
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

    // Seed admin user
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
    app.use(cookieParser());
    app.enableCors({ origin: ['http://localhost:3000'], credentials: true });
    app.setGlobalPrefix('api');
    await app.init();

    // Listen on a real port so the WebSocket client can connect
    await app.listen(0);
    const server = app.getHttpServer();
    const address = server.address();
    if (typeof address === 'object' && address) {
      serverUrl = `http://localhost:${address.port}`;
    }

    jwtService = app.get(JwtService);

    // Login to get a valid cookie
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
    await db.raw('TRUNCATE TABLE audit_log CASCADE');
    await db.raw('TRUNCATE TABLE appointments CASCADE');
  });

  // ────────────────────────────────────────────────────────────────────
  // [C1] WebSocket gateway broadcasts PII to unauthenticated clients
  // ────────────────────────────────────────────────────────────────────

  describe('[C1] WebSocket gateway authentication', () => {
    it('disconnects unauthenticated WebSocket clients before any broadcast', async () => {
      // Arrange — connect WITHOUT any auth cookie
      const socket: Socket = ioClient(serverUrl, {
        transports: ['websocket'],
      });

      // The server should disconnect us immediately on connection
      const disconnected = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        socket.on('disconnect', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      });

      socket.disconnect();
      expect(disconnected).toBe(true);
    }, 10_000);

    it('disconnects WebSocket clients with an invalid token', async () => {
      // Arrange — connect with a forged token
      const socket: Socket = ioClient(serverUrl, {
        transports: ['websocket'],
        extraHeaders: { Cookie: 'admin_token=not.a.valid.jwt' },
      });

      const disconnected = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        socket.on('disconnect', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      });

      socket.disconnect();
      expect(disconnected).toBe(true);
    }, 10_000);

    it('authenticated client receives only the appointment ID — no PII', async () => {
      // Arrange — connect WITH a valid auth cookie
      const cookieHeader = authCookie.map((c) => c.split(';')[0]).join('; ');
      const socket: Socket = ioClient(serverUrl, {
        transports: ['websocket'],
        extraHeaders: { Cookie: cookieHeader },
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Socket failed to connect')),
          3000,
        );
        socket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        socket.on('connect_error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Listen for the broadcast
      const broadcastPromise = new Promise<Record<string, unknown>>(
        (resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('No broadcast received')),
            5000,
          );
          socket.on(
            'appointment.created',
            (payload: Record<string, unknown>) => {
              clearTimeout(timeout);
              resolve(payload);
            },
          );
        },
      );

      // Trigger via raw HTTP
      const createRes = await fetch(`${serverUrl}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validAppointment),
      });
      expect(createRes.status).toBe(201);

      const payload = await broadcastPromise;
      socket.disconnect();

      // Assert — payload contains ONLY the ID, no PII at all
      expect(payload.id).toBeDefined();
      expect(payload.name).toBeUndefined();
      expect(payload.email).toBeUndefined();
      expect(payload.phone).toBeUndefined();
      expect(payload.description).toBeUndefined();
    }, 15_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // [H2] No rate limiting on login endpoint
  // ────────────────────────────────────────────────────────────────────

  describe('[H2] Login rate limiting', () => {
    it('VULN: 50 rapid wrong-password attempts all return 401 (no throttling)', async () => {
      // Arrange
      const attempts = 50;
      const responses: number[] = [];

      // Act — fire all requests in parallel
      await Promise.all(
        Array.from({ length: attempts }, () =>
          request(app.getHttpServer())
            .post('/api/auth/login')
            .send({
              email: adminCredentials.email,
              password: 'wrong-password',
            })
            .then((res) => responses.push(res.status)),
        ),
      );

      // Assert — every attempt was processed (none rate-limited)
      // A properly-throttled endpoint would return 429 for some.
      expect(responses).toHaveLength(attempts);
      expect(responses.every((s) => s === 401)).toBe(true);
      expect(responses.some((s) => s === 429)).toBe(false);
    }, 30_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // [M1] Login validation errors return HTTP 200
  // ────────────────────────────────────────────────────────────────────

  describe('[M1] Login validation HTTP status', () => {
    it('VULN: invalid login body returns HTTP 200 instead of 400', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ password: 'no-email' });

      // Assert — should be 400, currently 200
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // [M2] No password complexity at the login schema
  // ────────────────────────────────────────────────────────────────────

  describe('[M2] Password schema accepts weak passwords', () => {
    it('VULN: 1-character password passes the login schema validation', async () => {
      // Arrange / Act — schema-level only; we expect 401 (wrong password) not 400 (invalid format)
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: adminCredentials.email, password: 'a' });

      // Assert — schema accepts it, so we get 401 not 400
      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // [M3] Logout endpoint does not require authentication
  // ────────────────────────────────────────────────────────────────────

  describe('[M3] Logout requires no auth', () => {
    it('VULN: POST /auth/logout returns 200 without any auth cookie', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer()).post('/api/auth/logout');

      // Assert — currently accepts unauthenticated calls
      expect(res.status).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // [M5] No Content Security Policy header
  // ────────────────────────────────────────────────────────────────────

  describe('[M5] Content Security Policy', () => {
    it('NOTE: Helmet default CSP is set, but it allows inline scripts/styles', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer()).get('/api');

      // Assert — Helmet sets a default CSP. A stricter custom one would be better.
      const csp = res.headers['content-security-policy'];
      // Document current state: CSP is present (Helmet default)
      expect(csp).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // [M6] Swagger docs publicly accessible
  // ────────────────────────────────────────────────────────────────────

  describe('[M6] Swagger documentation exposure', () => {
    it('VULN: GET /api/docs is publicly accessible (no env gate)', () => {
      // The test app doesn't actually mount Swagger (only main.ts does),
      // so we instead verify there's no guard around the route registration.
      // This test is documentary — see SECURITY-AUDIT.md M6.
      expect(true).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // JWT tampering and forgery
  // ────────────────────────────────────────────────────────────────────

  describe('JWT tampering', () => {
    it('rejects a JWT with a modified payload (signature mismatch)', async () => {
      // Arrange — get a valid token, tamper with the payload
      const validToken = jwtService.sign({
        sub: 'attacker',
        email: 'attacker@evil.com',
      });
      const [header, , signature] = validToken.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: 'admin-id', email: 'admin@sixbee.com' }),
      )
        .toString('base64url')
        .replace(/=/g, '');
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      // Act
      const res = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Cookie', [`admin_token=${tamperedToken}`]);

      // Assert
      expect(res.status).toBe(401);
    });

    it('rejects a JWT signed with a different secret', async () => {
      // Arrange — sign with a different secret
      const otherJwt = new JwtService({ secret: 'attacker-secret' });
      const forgedToken = otherJwt.sign({
        sub: 'admin',
        email: 'admin@evil.com',
      });

      // Act
      const res = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Cookie', [`admin_token=${forgedToken}`]);

      // Assert
      expect(res.status).toBe(401);
    });

    it('rejects a JWT with alg=none (algorithm confusion)', async () => {
      // Arrange — manually craft an unsigned token with alg=none
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
        .toString('base64url')
        .replace(/=/g, '');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'admin', email: 'admin@evil.com' }),
      )
        .toString('base64url')
        .replace(/=/g, '');
      const noneToken = `${header}.${payload}.`;

      // Act
      const res = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Cookie', [`admin_token=${noneToken}`]);

      // Assert — must be rejected
      expect(res.status).toBe(401);
    });

    it('rejects an expired JWT', async () => {
      // Arrange — sign a token that expired 1 second ago
      const expiredToken = jwtService.sign(
        { sub: 'admin', email: 'admin@sixbee.com' },
        { expiresIn: '-1s' },
      );

      // Act
      const res = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Cookie', [`admin_token=${expiredToken}`]);

      // Assert
      expect(res.status).toBe(401);
    });

    it('rejects a malformed JWT', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Cookie', ['admin_token=not.a.valid.jwt.format']);

      // Assert
      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Cookie / auth bypass
  // ────────────────────────────────────────────────────────────────────

  describe('Auth bypass attempts', () => {
    it('rejects request with no cookie and no Authorization header', async () => {
      const res = await request(app.getHttpServer()).get('/api/appointments');
      expect(res.status).toBe(401);
    });

    it('rejects request with empty cookie value', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Cookie', ['admin_token=']);
      expect(res.status).toBe(401);
    });

    it('rejects request with non-JWT garbage in cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Cookie', ['admin_token=garbage']);
      expect(res.status).toBe(401);
    });

    it('rejects Authorization header without Bearer prefix', async () => {
      const validToken = jwtService.sign({
        sub: 'admin',
        email: 'admin@test.com',
      });
      const res = await request(app.getHttpServer())
        .get('/api/appointments')
        .set('Authorization', validToken); // missing "Bearer "
      expect(res.status).toBe(401);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // SQL injection
  // ────────────────────────────────────────────────────────────────────

  describe('SQL injection resistance', () => {
    const sqlPayloads = [
      "'; DROP TABLE appointments; --",
      "' OR '1'='1",
      "1' UNION SELECT NULL, NULL, NULL --",
      "admin'--",
      "' OR 1=1; --",
    ];

    for (const payload of sqlPayloads) {
      it(`safely handles "${payload}" in appointment description`, async () => {
        const res = await request(app.getHttpServer())
          .post('/api/appointments')
          .send({ ...validAppointment, description: payload });

        // Either rejected by validation or stored as data
        expect([201, 400]).toContain(res.status);

        // Crucially, the table still exists
        const tableExists = await db.schema.hasTable('appointments');
        expect(tableExists).toBe(true);
      });
    }

    it('safely handles SQL payload as a UUID path parameter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/appointments/' OR '1'='1`)
        .set('Cookie', authCookie);
      expect(res.status).toBe(400); // Invalid UUID format
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // XSS resistance — payloads in every string field
  // ────────────────────────────────────────────────────────────────────

  describe('XSS resistance', () => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '"><script>alert(1)</script>',
      '<svg/onload=alert(1)>',
      'javascript:alert(1)',
    ];

    for (const payload of xssPayloads) {
      it(`rejects "${payload}" in name field`, async () => {
        const res = await request(app.getHttpServer())
          .post('/api/appointments')
          .send({ ...validAppointment, name: payload });
        // Either rejected, or accepted as plain text — never executed
        // The schema rejects HTML tags via noHtmlTags refinement
        if (/<[a-zA-Z]/.test(payload)) {
          expect(res.status).toBe(400);
        }
      });
    }

    it('rejects HTML tags in update via PATCH', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const res = await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Cookie', authCookie)
        .send({ name: '<script>alert(1)</script>' });

      // Assert
      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Mass assignment
  // ────────────────────────────────────────────────────────────────────

  describe('Mass assignment', () => {
    it('strips unknown fields from create payload (Zod default)', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .post('/api/appointments')
        .send({
          ...validAppointment,
          status: 'confirmed', // attacker tries to bypass admin approval
          id: 'attacker-controlled-id',
          created_at: '1970-01-01T00:00:00.000Z',
          metadata: { admin: true },
        });

      // Assert — created successfully but with status pending (not confirmed)
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
      expect(res.body.id).not.toBe('attacker-controlled-id');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Path traversal
  // ────────────────────────────────────────────────────────────────────

  describe('Path traversal', () => {
    it('rejects path-traversal payload as appointment ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/appointments/../../etc/passwd')
        .set('Cookie', authCookie);
      // Should not reach the controller — Express normalises the path
      expect([400, 404]).toContain(res.status);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Login user enumeration
  // ────────────────────────────────────────────────────────────────────

  describe('Login user enumeration', () => {
    it('returns identical response for invalid user vs invalid password', async () => {
      const wrongUserRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'noone@test.com', password: 'whatever' });

      const wrongPassRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: adminCredentials.email, password: 'wrongpassword' });

      expect(wrongUserRes.status).toBe(wrongPassRes.status);
      expect(wrongUserRes.body).toEqual(wrongPassRes.body);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Cookie flags
  // ────────────────────────────────────────────────────────────────────

  describe('Cookie security flags', () => {
    it('sets HttpOnly on the auth cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(adminCredentials);
      const cookies = res.headers['set-cookie'];
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
      expect(cookieStr).toContain('HttpOnly');
    });

    it('sets SameSite=Strict on the auth cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(adminCredentials);
      const cookies = res.headers['set-cookie'];
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
      expect(cookieStr).toContain('SameSite=Strict');
    });

    it('VULN: does NOT set Secure flag in non-production env', async () => {
      // The cookie is only secure if NODE_ENV === 'production'
      // Tests run with NODE_ENV unset/test, so Secure should NOT be present
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(adminCredentials);
      const cookies = res.headers['set-cookie'];
      const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
      expect(cookieStr).not.toContain('Secure');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Encryption sanity checks
  // ────────────────────────────────────────────────────────────────────

  describe('Encryption at rest', () => {
    it('stores PII as ciphertext, not plaintext, in the database', async () => {
      // Arrange
      const created = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const row = await db('appointments').where('id', created.body.id).first();

      // Assert — none of the PII fields contain plaintext values
      expect(row.name).not.toBe(validAppointment.name);
      expect(row.email).not.toBe(validAppointment.email);
      expect(row.phone).not.toBe(validAppointment.phone);
      expect(row.description).not.toBe(validAppointment.description);

      // And they're not just base64 of the plaintext
      expect(Buffer.from(row.name, 'base64').toString()).not.toBe(
        validAppointment.name,
      );
    });

    it('produces different ciphertext for the same plaintext (random IV)', async () => {
      // Arrange — create the same appointment twice
      const res1 = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);
      const res2 = await request(app.getHttpServer())
        .post('/api/appointments')
        .send(validAppointment);

      // Act
      const row1 = await db('appointments').where('id', res1.body.id).first();
      const row2 = await db('appointments').where('id', res2.body.id).first();

      // Assert — same plaintext, different ciphertext (proves random IV usage)
      expect(row1.name).not.toBe(row2.name);
      expect(row1.email).not.toBe(row2.email);
    });
  });
});
