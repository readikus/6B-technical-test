export class AppointmentEvent {
  constructor(
    public readonly action: 'created' | 'updated' | 'deleted' | 'approved',
    public readonly appointmentId: string,
    public readonly changes: Record<string, unknown>,
    public readonly adminUserId?: string,
  ) {}
}

export const APPOINTMENT_AUDIT = 'appointment.audit';
