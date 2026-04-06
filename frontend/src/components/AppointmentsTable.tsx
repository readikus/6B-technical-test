'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '../lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Appointment {
  id: string;
  name: string;
  email: string;
  phone: string;
  description: string;
  appointmentDate: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
}

export default function AppointmentsTable() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchAppointments() {
      try {
        const response = await authFetch(`${API_URL}/api/appointments`);
        if (!response.ok) throw new Error('Failed to load');
        const data = await response.json();
        if (!cancelled) setAppointments(data);
      } catch {
        if (!cancelled) setError('Failed to load appointments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAppointments();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-zinc-500 dark:text-zinc-400">Loading appointments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-red-800 dark:text-red-200 text-sm"
      >
        {error}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500 dark:text-zinc-400">No appointments found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-800">
          <tr>
            {['Name', 'Email', 'Phone', 'Date & Time', 'Description', 'Status'].map(
              (header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                >
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700 bg-white dark:bg-zinc-900">
          {appointments.map((apt) => (
            <tr key={apt.id} className={rowClass(apt.status)}>
              <td className="whitespace-nowrap px-4 py-3 text-sm">{apt.name}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">{apt.email}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">{apt.phone}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">
                {formatDate(apt.appointmentDate)}
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-sm">{apt.description}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">
                <StatusBadge status={apt.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rowClass(status: Appointment['status']): string {
  switch (status) {
    case 'approved':
      return 'bg-green-50 dark:bg-green-900/20';
    case 'declined':
      return 'bg-red-50 dark:bg-red-900/20';
    default:
      return '';
  }
}

function StatusBadge({ status }: { status: Appointment['status'] }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    declined: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
