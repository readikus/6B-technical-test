import { FhirMapper } from './fhir.mapper';
import type { AppointmentRow } from '../appointments/appointments.repository';

describe('FhirMapper', () => {
  let mapper: FhirMapper;

  const baseUrl = 'http://localhost:3001/api';

  const appointment: AppointmentRow = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '07700900123',
    description: 'Routine check-up appointment',
    date_time: '2026-04-10T09:00:00.000Z',
    status: 'pending',
    metadata: {},
    created_at: '2026-04-01T10:00:00.000Z',
    updated_at: '2026-04-01T10:00:00.000Z',
  };

  beforeEach(() => {
    mapper = new FhirMapper(baseUrl);
  });

  describe('toFhirAppointment', () => {
    it('returns resourceType "Appointment"', () => {
      // Arrange
      const input = { ...appointment };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.resourceType).toBe('Appointment');
      expect(result.id).toBe(appointment.id);
    });

    it('includes meta with FHIR profile URL', () => {
      // Arrange
      const input = { ...appointment };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.meta.profile).toContain(
        'http://hl7.org/fhir/StructureDefinition/Appointment',
      );
      expect(result.meta.lastUpdated).toBe(appointment.updated_at);
    });

    it('maps pending status to proposed', () => {
      // Arrange
      const input = { ...appointment, status: 'pending' };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.status).toBe('proposed');
    });

    it('maps confirmed status to booked', () => {
      // Arrange
      const input = { ...appointment, status: 'confirmed' };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.status).toBe('booked');
    });

    it('maps cancelled status to cancelled', () => {
      // Arrange
      const input = { ...appointment, status: 'cancelled' };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.status).toBe('cancelled');
    });

    it('sets start from date_time', () => {
      // Arrange
      const input = { ...appointment };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.start).toBe('2026-04-10T09:00:00.000Z');
    });

    it('sets description from appointment description', () => {
      // Arrange
      const input = { ...appointment };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.description).toBe('Routine check-up appointment');
    });

    it('sets created from created_at', () => {
      // Arrange
      const input = { ...appointment };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.created).toBe('2026-04-01T10:00:00.000Z');
    });

    it('contains a Patient resource with name and telecom', () => {
      // Arrange
      const input = { ...appointment };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.contained).toHaveLength(1);
      const patient = result.contained[0];
      expect(patient.resourceType).toBe('Patient');
      expect(patient.name[0].text).toBe('Jane Smith');
      expect(patient.telecom).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ system: 'phone', value: '07700900123' }),
          expect.objectContaining({ system: 'email', value: 'jane@example.com' }),
        ]),
      );
    });

    it('includes participant referencing the contained patient', () => {
      // Arrange
      const input = { ...appointment };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.participant).toHaveLength(1);
      const participant = result.participant[0];
      expect(participant.actor.reference).toMatch(/^#patient-/);
      expect(participant.actor.display).toBe('Jane Smith');
    });

    it('patient id matches participant actor reference', () => {
      // Arrange
      const input = { ...appointment };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      const patientId = result.contained[0].id;
      expect(result.participant[0].actor.reference).toBe(`#${patientId}`);
    });

    it('sets participant status to accepted for pending/confirmed', () => {
      // Arrange & Act
      const pending = mapper.toFhirAppointment({ ...appointment, status: 'pending' });
      const confirmed = mapper.toFhirAppointment({ ...appointment, status: 'confirmed' });

      // Assert
      expect(pending.participant[0].status).toBe('accepted');
      expect(confirmed.participant[0].status).toBe('accepted');
    });

    it('sets participant status to declined for cancelled', () => {
      // Arrange
      const input = { ...appointment, status: 'cancelled' };

      // Act
      const result = mapper.toFhirAppointment(input);

      // Assert
      expect(result.participant[0].status).toBe('declined');
    });
  });

  describe('toFhirBundle', () => {
    it('returns a searchset Bundle', () => {
      // Arrange
      const appointments = [appointment];

      // Act
      const result = mapper.toFhirBundle(appointments);

      // Assert
      expect(result.resourceType).toBe('Bundle');
      expect(result.type).toBe('searchset');
    });

    it('sets total to the number of appointments', () => {
      // Arrange
      const appointments = [appointment, { ...appointment, id: 'second-id' }];

      // Act
      const result = mapper.toFhirBundle(appointments);

      // Assert
      expect(result.total).toBe(2);
    });

    it('includes an entry per appointment with fullUrl', () => {
      // Arrange
      const appointments = [appointment];

      // Act
      const result = mapper.toFhirBundle(appointments);

      // Assert
      expect(result.entry).toHaveLength(1);
      expect(result.entry[0].resource.resourceType).toBe('Appointment');
      expect(result.entry[0].fullUrl).toBe(
        `${baseUrl}/fhir/Appointment/${appointment.id}`,
      );
    });

    it('returns empty entries for no appointments', () => {
      // Arrange
      const appointments: AppointmentRow[] = [];

      // Act
      const result = mapper.toFhirBundle(appointments);

      // Assert
      expect(result.total).toBe(0);
      expect(result.entry).toEqual([]);
    });

    it('has meta with Bundle profile', () => {
      // Arrange
      const appointments = [appointment];

      // Act
      const result = mapper.toFhirBundle(appointments);

      // Assert
      expect(result.meta.profile).toContain(
        'http://hl7.org/fhir/StructureDefinition/Bundle',
      );
    });
  });
});
