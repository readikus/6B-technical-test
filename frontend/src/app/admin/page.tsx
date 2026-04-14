'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const FILTER_KEY = 'admin_filter_tab';

const tabs = ['all', 'unconfirmed', 'today', 'past'] as const;
type FilterTab = (typeof tabs)[number];

const tabLabels: Record<FilterTab, string> = {
  all: 'All',
  unconfirmed: 'Unconfirmed',
  today: "Today's",
  past: 'Past',
};

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function filterAppointments(
  appointments: ApiAppointment[],
  tab: FilterTab,
): ApiAppointment[] {
  const now = new Date();
  switch (tab) {
    case 'unconfirmed':
      return appointments.filter((a) => a.status === 'pending');
    case 'today':
      return appointments.filter((a) => isToday(new Date(a.date_time)));
    case 'past':
      return appointments.filter((a) => new Date(a.date_time) < now);
    default:
      return appointments;
  }
}

function readStoredTab(): FilterTab {
  if (typeof window === 'undefined') return 'all';
  const stored = localStorage.getItem(FILTER_KEY);
  return tabs.includes(stored as FilterTab) ? (stored as FilterTab) : 'all';
}

export default function AdminDashboardPage() {
  const { logout } = useAuth();
  const [appointments, setAppointments] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>(readStoredTab);

  const selectTab = (tab: FilterTab) => {
    setActiveTab(tab);
    localStorage.setItem(FILTER_KEY, tab);
  };

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
    const socket = io(API_URL, {
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

  const filtered = useMemo(
    () => filterAppointments(appointments, activeTab),
    [appointments, activeTab],
  );

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

      <div
        className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1"
        role="tablist"
        aria-label="Filter appointments"
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900',
            )}
            onClick={() => selectTab(tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <AppointmentsTable
        appointments={filtered}
        onApprove={handleApprove}
        onDelete={handleDelete}
      />
    </div>
  );
}
