export class AppointmentEvent {
  constructor(
    public readonly action: 'created' | 'updated' | 'deleted',
    public readonly appointmentId: string,
    public readonly changes: Record<string, unknown>,
  ) {}
}

export const APPOINTMENT_AUDIT = 'appointment.audit';
