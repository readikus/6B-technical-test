'use client';

import { Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApiAppointment } from '@/lib/api';

interface AppointmentsTableProps {
  appointments: ApiAppointment[];
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function AppointmentsTable({
  appointments,
  onApprove,
  onDelete,
}: AppointmentsTableProps) {
  if (appointments.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">No appointments found.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-gray-50 text-xs uppercase text-gray-600">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Date &amp; Time</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appt) => (
            <tr
              key={appt.id}
              className={cn(
                'border-b transition-colors',
                appt.status === 'confirmed'
                  ? 'bg-green-50'
                  : 'hover:bg-gray-50',
              )}
            >
              <td className="px-4 py-3 font-medium">{appt.name}</td>
              <td className="px-4 py-3">{formatDateTime(appt.date_time)}</td>
              <td className="max-w-xs truncate px-4 py-3">
                {appt.description}
              </td>
              <td className="px-4 py-3">{appt.phone}</td>
              <td className="px-4 py-3">{appt.email}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onApprove(appt.id)}
                    disabled={appt.status === 'confirmed'}
                    aria-label={`Approve appointment for ${appt.name}`}
                    className={cn(
                      'rounded p-1.5',
                      appt.status === 'confirmed'
                        ? 'text-green-600 cursor-default'
                        : 'text-gray-400 hover:bg-green-50 hover:text-green-600',
                    )}
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete appointment for ${appt.name}?`,
                        )
                      ) {
                        onDelete(appt.id);
                      }
                    }}
                    aria-label={`Delete appointment for ${appt.name}`}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
