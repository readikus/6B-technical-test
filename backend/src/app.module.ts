import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EncryptionModule } from './encryption/encryption.module';
import { DatabaseModule } from './database/database.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    // Global rate limiting. forRootAsync defers config evaluation
    // until module instantiation so tests can override the limits via
    // env vars set in beforeAll.
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          name: 'default',
          ttl: Number(process.env.THROTTLE_TTL_MS) || 60_000,
          limit: Number(process.env.THROTTLE_LIMIT) || 100,
        },
        {
          name: 'login',
          ttl: Number(process.env.LOGIN_THROTTLE_TTL_MS) || 60_000,
          limit: Number(process.env.LOGIN_THROTTLE_LIMIT) || 5,
        },
      ],
    }),
    EncryptionModule,
    DatabaseModule,
    AppointmentsModule,
    AuditModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
