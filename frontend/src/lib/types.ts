export interface Appointment {
  id: string;
  name: string;
  email: string;
  phone: string;
  description: string;
  appointmentDate: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  appointmentId: string;
  adminId: string;
  action: string;
  changes: string | null;
  createdAt: string;
}
