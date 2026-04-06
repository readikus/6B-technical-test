import type { BookingFormData } from './schemas';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function parseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

export interface ApiAppointment {
  id: string;
  name: string;
  email: string;
  phone: string;
  description: string;
  date_time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  appointment_id: string | null;
  admin_user_id: string | null;
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
}

export async function createAppointment(data: BookingFormData) {
  const response = await fetch(`${API_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      date_time: new Date(data.date_time).toISOString(),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const msg = body?.message;
    throw new Error(
      Array.isArray(msg) ? msg.join('. ') : msg ?? 'Failed to book appointment',
    );
  }

  return response.json();
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<{ access_token: string }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || 'Login failed');
  }

  return res.json();
}

export async function fetchAppointments(
  token: string,
): Promise<ApiAppointment[]> {
  const res = await fetch(`${API_URL}/api/appointments`, {
    headers: authHeaders(token),
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error('Failed to fetch appointments');
  }

  return res.json();
}

export async function getAppointment(
  token: string,
  id: string,
): Promise<ApiAppointment> {
  const res = await fetch(`${API_URL}/api/appointments/${id}`, {
    headers: authHeaders(token),
  });

  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to fetch appointment');

  return res.json();
}

export async function updateAppointment(
  token: string,
  id: string,
  data: Record<string, unknown>,
): Promise<ApiAppointment> {
  const res = await fetch(`${API_URL}/api/appointments/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to update appointment');

  return res.json();
}

export async function approveAppointment(
  token: string,
  id: string,
): Promise<ApiAppointment> {
  const res = await fetch(`${API_URL}/api/appointments/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status: 'confirmed' }),
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error('Failed to approve appointment');
  }

  return res.json();
}

export async function deleteAppointment(
  token: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/appointments/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error('Failed to delete appointment');
  }
}

export async function getAuditLog(
  token: string,
  appointmentId: string,
): Promise<AuditLogEntry[]> {
  const res = await fetch(
    `${API_URL}/api/appointments/${appointmentId}/audit`,
    { headers: authHeaders(token) },
  );

  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to fetch audit log');

  return res.json();
}

export { parseError };
