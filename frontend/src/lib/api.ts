import { authFetch } from './auth';
import type { Appointment, AuditLogEntry } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }
  // 204 No Content — return empty
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function approveAppointment(id: string): Promise<Appointment> {
  const response = await authFetch(`${API_URL}/api/appointments/${id}/approve`, {
    method: 'PATCH',
  });
  return handleResponse<Appointment>(response);
}

export async function declineAppointment(id: string): Promise<Appointment> {
  const response = await authFetch(`${API_URL}/api/appointments/${id}/decline`, {
    method: 'PATCH',
  });
  return handleResponse<Appointment>(response);
}

export async function deleteAppointment(id: string): Promise<void> {
  const response = await authFetch(`${API_URL}/api/appointments/${id}`, {
    method: 'DELETE',
  });
  await handleResponse<void>(response);
}

export async function updateAppointment(
  id: string,
  data: Partial<Omit<Appointment, 'id' | 'status' | 'createdAt'>>,
): Promise<Appointment> {
  const response = await authFetch(`${API_URL}/api/appointments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Appointment>(response);
}

export async function fetchAuditLog(id: string): Promise<AuditLogEntry[]> {
  const response = await authFetch(`${API_URL}/api/appointments/${id}/audit`);
  return handleResponse<AuditLogEntry[]>(response);
}
