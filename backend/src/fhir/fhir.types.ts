/**
 * FHIR R4 type definitions for Appointment resource.
 * @see https://hl7.org/fhir/R4/appointment.html
 */

export interface FhirAppointment {
  resourceType: 'Appointment';
  id: string;
  meta: FhirMeta;
  status: FhirAppointmentStatus;
  description: string;
  start: string;
  created: string;
  participant: FhirParticipant[];
  contained: FhirPatient[];
}

export type FhirAppointmentStatus =
  | 'proposed'
  | 'pending'
  | 'booked'
  | 'arrived'
  | 'fulfilled'
  | 'cancelled'
  | 'noshow'
  | 'entered-in-error'
  | 'checked-in'
  | 'waitlist';

export interface FhirMeta {
  versionId: string;
  lastUpdated: string;
  profile: string[];
}

export interface FhirParticipant {
  actor: FhirReference;
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
}

export interface FhirReference {
  reference: string;
  display: string;
}

export interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  name: FhirHumanName[];
  telecom: FhirContactPoint[];
}

export interface FhirHumanName {
  text: string;
}

export interface FhirContactPoint {
  system: 'phone' | 'email';
  value: string;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  id: string;
  meta: FhirMeta;
  type: 'searchset';
  total: number;
  entry: FhirBundleEntry[];
}

export interface FhirBundleEntry {
  fullUrl: string;
  resource: FhirAppointment;
}
