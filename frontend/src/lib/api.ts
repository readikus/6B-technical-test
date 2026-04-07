import type { BookingFormData } from './schemas';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const jsonHeaders: HeadersInit = { 'Content-Type': 'application/json' };

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

/**
 * Wraps fetch with friendly, clinic-grade error messages. Three
 * failure modes are mapped to copy a non-technical user can act on:
 *
 *   - fetch() throws (network failure, CORS rejected, server down):
 *     "Can't reach the booking system..."
 *   - 401 Unauthorized: re-thrown as Error('Unauthorized') so the
 *     auth context can detect it and redirect to /admin/login.
 *     Do NOT change this string — it is a load-bearing sentinel.
 *   - any other non-2xx: prefer the server's `message` field if it
 *     looks user-safe, otherwise fall back to the {@code fallback}
 *     parameter.
 *
 * Returns the raw Response so callers can decide whether to parse
 * JSON, return void, etc.
 */
async function apiFetch(
  path: string,
  init: RequestInit | undefined,
  fallback: string,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      ...init,
    });
  } catch {
    // fetch() throws TypeError on network or CORS failure. The
    // browser surfaces this as the literal string "Failed to fetch",
    // which is meaningless to a non-technical user.
    throw new Error(
      "Can't reach the booking system. Please check your internet connection and try again.",
    );
  }

  if (res.status === 401) {
    // Sentinel — auth-context.tsx checks for this exact string.
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = data?.message;
    throw new Error(
      Array.isArray(msg)
        ? msg.join('. ')
        : (msg ?? fallback),
    );
  }

  return res;
}

export async function createAppointment(data: BookingFormData) {
  const res = await apiFetch(
    '/api/appointments',
    {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        ...data,
        date_time: new Date(data.date_time).toISOString(),
      }),
    },
    "We couldn't book your appointment. Please try again, or contact the clinic if the problem continues.",
  );
  return res.json();
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<{ ok: boolean }> {
  // Login intentionally does not use apiFetch: it needs custom
  // copy for 401 ("incorrect credentials") and 429 ("too many
  // attempts") that other endpoints don't.
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: jsonHeaders,
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(
      "Can't reach the booking system. Please check your internet connection and try again.",
    );
  }

  if (res.status === 401) {
    throw new Error('Email or password is incorrect. Please try again.');
  }
  if (res.status === 429) {
    throw new Error(
      'Too many sign-in attempts. Please wait a minute and try again.',
    );
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = data?.message;
    throw new Error(
      Array.isArray(msg)
        ? msg.join('. ')
        : msg ??
          "Something went wrong while signing in. Please try again, or contact support if the problem continues.",
    );
  }

  return res.json();
}

export async function logoutRequest(): Promise<void> {
  // Best-effort: a failed logout shouldn't block the user from
  // being signed out client-side. Swallow errors silently.
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // intentional no-op
  }
}

export async function fetchCurrentAdmin(): Promise<{
  id: string;
  email: string;
}> {
  const res = await apiFetch(
    '/api/auth/me',
    undefined,
    "We couldn't load your account. Please try signing in again.",
  );
  return res.json();
}

export async function fetchAppointments(): Promise<ApiAppointment[]> {
  const res = await apiFetch(
    '/api/appointments',
    undefined,
    "We couldn't load the appointment list. Please refresh the page, or contact support if the problem continues.",
  );
  return res.json();
}

export async function getAppointment(id: string): Promise<ApiAppointment> {
  const res = await apiFetch(
    `/api/appointments/${id}`,
    undefined,
    "We couldn't load this appointment. Please refresh the page, or contact support if the problem continues.",
  );
  return res.json();
}

export async function updateAppointment(
  id: string,
  data: Record<string, unknown>,
): Promise<ApiAppointment> {
  const res = await apiFetch(
    `/api/appointments/${id}`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    },
    "We couldn't save your changes. Please try again, or contact support if the problem continues.",
  );
  return res.json();
}

export async function approveAppointment(
  id: string,
): Promise<ApiAppointment> {
  const res = await apiFetch(
    `/api/appointments/${id}`,
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'confirmed' }),
    },
    "We couldn't approve this appointment. Please try again, or contact support if the problem continues.",
  );
  return res.json();
}

export async function deleteAppointment(id: string): Promise<void> {
  await apiFetch(
    `/api/appointments/${id}`,
    { method: 'DELETE' },
    "We couldn't delete this appointment. Please try again, or contact support if the problem continues.",
  );
}

export async function getAuditLog(
  appointmentId: string,
): Promise<AuditLogEntry[]> {
  const res = await apiFetch(
    `/api/appointments/${appointmentId}/audit`,
    undefined,
    "We couldn't load the change history for this appointment. Please refresh the page, or contact support if the problem continues.",
  );
  return res.json();
}

export { parseError };
