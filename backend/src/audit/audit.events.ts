export interface AuditContext {
  adminUserId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AppointmentEvent {
  constructor(
    public readonly action: 'created' | 'updated' | 'deleted' | 'approved',
    public readonly appointmentId: string,
    public readonly changes: Record<string, unknown>,
    public readonly context: AuditContext = {},
  ) {}
}

export const APPOINTMENT_AUDIT = 'appointment.audit';
