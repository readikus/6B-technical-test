import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuthModule } from '../auth/auth.module';
import { FhirController } from './fhir.controller';

@Module({
  imports: [AppointmentsModule, AuthModule],
  controllers: [FhirController],
})
export class FhirModule {}
