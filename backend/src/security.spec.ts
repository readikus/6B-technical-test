import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import helmet from 'helmet';
import { AppModule } from './app.module';

describe('Security middleware', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.POSTGRES_DB = 'sixbee_health_test';
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(helmet());
    app.enableCors({ origin: ['http://localhost:3000'] });
    await app.init();
  }, 15_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('Helmet', () => {
    it('sets x-content-type-options to nosniff', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer()).get('/');

      // Assert
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets x-frame-options to SAMEORIGIN', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer()).get('/');

      // Assert
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('CORS', () => {
    it('returns access-control-allow-origin for allowed origin', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .options('/')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      // Assert
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
    });

    it('does not return access-control-allow-origin for disallowed origin', async () => {
      // Arrange / Act
      const res = await request(app.getHttpServer())
        .options('/')
        .set('Origin', 'http://evil.com')
        .set('Access-Control-Request-Method', 'GET');

      // Assert
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
