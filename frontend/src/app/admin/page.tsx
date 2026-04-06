'use client';

import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@/lib/auth-context';
import {
  fetchAppointments,
  approveAppointment,
  deleteAppointment,
  parseError,
  type ApiAppointment,
} from '@/lib/api';
import { AppointmentsTable } from '@/components/appointments-table';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AdminDashboardPage() {
  const { token, logout } = useAuth();
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchAppointments(token);
      const sorted = data.sort(
        (a, b) =>
          new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
      );
      setAppointments(sorted);
      setError(null);
    } catch (err) {
      if (parseError(err) === 'Unauthorized') {
        logout();
        return;
      }
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'] });

    socket.on('appointment.created', (appointment: ApiAppointment) => {
      setAppointments((prev) => {
        if (prev.some((a) => a.id === appointment.id)) return prev;
        return [...prev, appointment].sort(
          (a, b) =>
            new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
        );
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleApprove = async (id: string) => {
    if (!token) return;
    try {
      const updated = await approveAppointment(token, id);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? updated : a)),
      );
    } catch (err) {
      if (parseError(err) === 'Unauthorized') {
        logout();
        return;
      }
      setError(parseError(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await deleteAppointment(token, id);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      if (parseError(err) === 'Unauthorized') {
        logout();
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
