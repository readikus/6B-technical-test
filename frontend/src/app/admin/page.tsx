'use client';

import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@/lib/auth-context';
import {
  fetchAppointments,
  getAppointment,
  approveAppointment,
  deleteAppointment,
  parseError,
  type ApiAppointment,
} from '@/lib/api';
import { AppointmentsTable } from '@/components/appointments-table';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Socket.IO endpoint. Defaults to API_URL because NestJS serves
// Socket.IO from the same port as its HTTP API. The Spring Boot
// backend serves it from a dedicated port (default 3003) because
// netty-socketio is its own netty server and cannot share Tomcat's
// listening socket — set NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3003
// in .env when running against Spring.
const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_WEBSOCKET_URL || API_URL;

export default function AdminDashboardPage() {
  const { logout } = useAuth();
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      const data = await fetchAppointments();
      const sorted = data.sort(
        (a, b) =>
          new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
      );
      setAppointments(sorted);
      setError(null);
    } catch (err) {
      if (parseError(err) === 'Unauthorized') {
        await logout();
        return;
      }
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    // The cookie auth is sent automatically because withCredentials is true
    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('appointment.created', async ({ id }: { id: string }) => {
      // The broadcast contains only the ID (no PII over the WebSocket).
      // Re-fetch the full appointment via the authenticated REST endpoint.
      try {
        const appointment = await getAppointment(id);
        setAppointments((prev) => {
          if (prev.some((a) => a.id === appointment.id)) return prev;
          return [...prev, appointment].sort(
            (a, b) =>
              new Date(a.date_time).getTime() -
              new Date(b.date_time).getTime(),
          );
        });
      } catch {
        // If the fetch fails, silently ignore — the next refresh will catch it
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const updated = await approveAppointment(id);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? updated : a)),
      );
    } catch (err) {
      if (parseError(err) === 'Unauthorized') {
        await logout();
        return;
      }
      setError(parseError(err));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAppointment(id);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      if (parseError(err) === 'Unauthorized') {
        await logout();
        return;
      }
      setError(parseError(err));
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-gray-500">Loading…</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Appointments</h1>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <AppointmentsTable
        appointments={appointments}
        onApprove={handleApprove}
        onDelete={handleDelete}
      />
    </div>
  );
}
