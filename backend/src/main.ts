import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { helmetConfig } from './security-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust the first proxy hop so that rate limiting and audit logging
  // see the real client IP, not the load balancer's.
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');

  // Stricter CSP than Helmet defaults: deny inline scripts, restrict
  // every fetch directive to same-origin. The API only serves JSON, so
  // a tight CSP costs nothing and gives defence-in-depth against
  // reflected XSS.
  app.use(helmet(helmetConfig));
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  });

  // Swagger UI is exposed only in non-production environments to avoid
  // leaking the API schema and example payloads to attackers.
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('6B Health Appointments API')
      .setDescription('Healthcare appointment booking and management API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
