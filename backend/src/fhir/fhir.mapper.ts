import { randomUUID } from 'node:crypto';
import type { AppointmentRow } from '../appointments/appointments.repository';
import type {
  FhirAppointment,
  FhirAppointmentStatus,
  FhirBundle,
  FhirPatient,
} from './fhir.types';

const STATUS_MAP: Record<string, FhirAppointmentStatus> = {
  pending: 'proposed',
  confirmed: 'booked',
  cancelled: 'cancelled',
};

const PARTICIPANT_STATUS_MAP: Record<string, 'accepted' | 'declined'> = {
  pending: 'accepted',
  confirmed: 'accepted',
  cancelled: 'declined',
};

export class FhirMapper {
  constructor(private readonly baseUrl: string) {}

  toFhirAppointment(apt: AppointmentRow): FhirAppointment {
    const patientId = `patient-${apt.id}`;

    const patient: FhirPatient = {
      resourceType: 'Patient',
      id: patientId,
      name: [{ text: apt.name }],
      telecom: [
        { system: 'phone', value: apt.phone },
        { system: 'email', value: apt.email },
      ],
    };

    return {
      resourceType: 'Appointment',
      id: apt.id,
      meta: {
        versionId: '1',
        lastUpdated: apt.updated_at,
        profile: ['http://hl7.org/fhir/StructureDefinition/Appointment'],
      },
      status: STATUS_MAP[apt.status] ?? 'proposed',
      description: apt.description,
      start: apt.date_time,
      created: apt.created_at,
      participant: [
        {
          actor: {
            reference: `#${patientId}`,
            display: apt.name,
          },
          status: PARTICIPANT_STATUS_MAP[apt.status] ?? 'accepted',
        },
      ],
      contained: [patient],
    };
  }

  toFhirBundle(appointments: AppointmentRow[]): FhirBundle {
    return {
      resourceType: 'Bundle',
      id: randomUUID(),
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
      },
      type: 'searchset',
      total: appointments.length,
      entry: appointments.map((apt) => ({
        fullUrl: `${this.baseUrl}/fhir/Appointment/${apt.id}`,
        resource: this.toFhirAppointment(apt),
      })),
    };
  }
}
