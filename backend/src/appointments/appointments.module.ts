import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentsRepository } from './appointments.repository';
import { AppointmentsGateway } from './appointments.gateway';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsRepository, AppointmentsGateway],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
