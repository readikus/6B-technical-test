'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  getAppointment,
  getAuditLog,
  type ApiAppointment,
  type AuditLogEntry,
} from '@/lib/api';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

const statusClass: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const actionLabel: Record<string, string> = {
  created: 'Created',
  updated: 'Edited',
  approved: 'Approved',
  deleted: 'Deleted',
};

function formatChangeValue(val: unknown): string {
  if (val === null || val === undefined) return 'empty';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export default function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { token, logout } = useAuth();

  const [appointment, setAppointment] = useState<ApiAppointment | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    Promise.all([getAppointment(token, id), getAuditLog(token, id)])
      .then(([apt, logs]) => {
        setAppointment(apt);
        setAuditLog(logs);
      })
      .catch((err) => {
        if (err instanceof Error && err.message === 'Unauthorized') {
          logout();
          return;
        }
        setError(
          err instanceof Error ? err.message : 'Failed to load appointment.',
        );
      })
      .finally(() => setLoading(false));
  }, [token, id, logout]);

  if (loading) {
    return <p className="py-8 text-center text-gray-500">Loading...</p>;
  }

  if (error || !appointment) {
    return (
      <div>
        <p className="text-red-600">{error ?? 'Appointment not found.'}</p>
        <Link href="/admin" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          Back to appointments
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to appointments
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">
        {appointment.name}
      </h1>
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass[appointment.status] ?? ''}`}
      >
        {statusLabel[appointment.status] ?? appointment.status}
      </span>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-gray-500">Date &amp; Time</dt>
        <dd>{dateFormat.format(new Date(appointment.date_time))}</dd>

        <dt className="text-gray-500">Email</dt>
        <dd>{appointment.email}</dd>

        <dt className="text-gray-500">Phone</dt>
        <dd>{appointment.phone}</dd>

        <dt className="text-gray-500">Description</dt>
        <dd className="whitespace-pre-wrap">{appointment.description}</dd>
      </dl>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Audit Log
        </h2>

        {auditLog.length === 0 ? (
          <p className="text-sm text-gray-500">
            No changes have been recorded for this appointment.
          </p>
        ) : (
          <ol className="relative ml-2 border-l border-gray-200">
            {auditLog.map((entry) => (
              <li key={entry.id} className="mb-6 ml-6">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-gray-200 bg-white" />
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {actionLabel[entry.action] ?? entry.action}
                  </span>
                </div>
                <time className="text-xs text-gray-500">
                  {dateFormat.format(new Date(entry.created_at))}
                </time>

                {entry.changes && Object.keys(entry.changes).length > 0 && (
                  <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
                    {Object.entries(entry.changes).map(([field, change]) => {
                      const c = change as { from?: unknown; to?: unknown } | unknown;
                      const hasFromTo = typeof c === 'object' && c !== null && 'from' in c;
                      return (
                        <div key={field} className="mb-1 last:mb-0">
                          <span className="font-medium text-gray-900">
                            {field}
                          </span>
                          :{' '}
                          {hasFromTo ? (
                            <>
                              <span className="text-gray-500">
                                {formatChangeValue((c as { from: unknown }).from)}
                              </span>
                              {' \u2192 '}
                              <span className="text-gray-900">
                                {formatChangeValue((c as { to: unknown }).to)}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-900">
                              {formatChangeValue(change)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
