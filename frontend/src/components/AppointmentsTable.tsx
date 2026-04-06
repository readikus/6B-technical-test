'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../lib/auth';
import { approveAppointment, declineAppointment, deleteAppointment } from '../lib/api';
import { useAppointmentSocket } from '../lib/useAppointmentSocket';
import type { Appointment } from '../lib/types';
import EditModal from './EditModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function AppointmentsTable() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── REST: initial fetch ───────────────────────────────────

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
    return () => {
      cancelled = true;
    };
  }, []);

  // ── WebSocket: real-time updates ──────────────────────────

  const handleWsCreated = useCallback((apt: Appointment) => {
    setAppointments((prev) => {
      // Avoid duplicates if we already have it (e.g. from our own POST)
      if (prev.some((a) => a.id === apt.id)) return prev;
      return [...prev, apt];
    });
  }, []);

  const handleWsUpdated = useCallback((apt: Appointment) => {
    setAppointments((prev) => prev.map((a) => (a.id === apt.id ? apt : a)));
  }, []);

  const handleWsDeleted = useCallback((id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const { connected } = useAppointmentSocket({
    onCreated: handleWsCreated,
    onUpdated: handleWsUpdated,
    onDeleted: handleWsDeleted,
  });

  function replaceAppointment(updated: Appointment) {
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  async function handleApprove(id: string) {
    try {
      const updated = await approveAppointment(id);
      replaceAppointment(updated);
    } catch {
      /* swallow — toast could be added later */
    }
  }

  async function handleDecline(id: string) {
    try {
      const updated = await declineAppointment(id);
      replaceAppointment(updated);
    } catch {
      /* swallow */
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingId) return;
    try {
      await deleteAppointment(deletingId);
      setAppointments((prev) => prev.filter((a) => a.id !== deletingId));
    } catch {
      /* swallow */
    } finally {
      setDeletingId(null);
    }
  }

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
    <>
      <div className="mb-3 flex justify-end">
        <span
          data-testid="ws-status"
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            connected
              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'
            }`}
          />
          {connected ? 'Live' : 'Connecting...'}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              {['Name', 'Email', 'Phone', 'Date & Time', 'Description', 'Status', 'Actions'].map(
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
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    {apt.status !== 'approved' && (
                      <ActionButton
                        label="Approve"
                        onClick={() => handleApprove(apt.id)}
                        variant="green"
                      />
                    )}
                    {apt.status !== 'declined' && apt.status !== 'pending' && (
                      <ActionButton
                        label="Decline"
                        onClick={() => handleDecline(apt.id)}
                        variant="red"
                      />
                    )}
                    {apt.status === 'pending' && (
                      <ActionButton
                        label="Decline"
                        onClick={() => handleDecline(apt.id)}
                        variant="red"
                      />
                    )}
                    <ActionButton
                      label="Edit"
                      onClick={() => setEditingAppointment(apt)}
                      variant="blue"
                    />
                    <ActionButton
                      label="Delete"
                      onClick={() => setDeletingId(apt.id)}
                      variant="red"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Are you sure you want to delete this appointment? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingAppointment && (
        <EditModal
          appointment={editingAppointment}
          onClose={() => setEditingAppointment(null)}
          onSaved={(updated) => {
            replaceAppointment(updated);
            setEditingAppointment(null);
          }}
        />
      )}
    </>
  );
}

function ActionButton({
  label,
  onClick,
  variant,
}: {
  label: string;
  onClick: () => void;
  variant: 'green' | 'red' | 'blue';
}) {
  const styles = {
    green:
      'text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30',
    red: 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30',
    blue: 'text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${styles[variant]}`}
    >
      {label}
    </button>
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
