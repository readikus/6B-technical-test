import type { BookingFormData } from './schemas';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

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
