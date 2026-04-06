import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EncryptionModule } from './encryption/encryption.module';
import { DatabaseModule } from './database/database.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { FhirModule } from './fhir/fhir.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    EncryptionModule,
    DatabaseModule,
    AppointmentsModule,
    AuditModule,
    AuthModule,
    FhirModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
