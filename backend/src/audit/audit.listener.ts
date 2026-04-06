import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from './audit.service';
import { AppointmentEvent, APPOINTMENT_AUDIT } from './audit.events';

@Injectable()
export class AuditListener {
  constructor(private readonly auditService: AuditService) {}

  @OnEvent(APPOINTMENT_AUDIT)
  async handleAppointmentAudit(event: AppointmentEvent) {
    await this.auditService.log(
      event.action,
      event.appointmentId,
      event.changes,
    );
  }
}
