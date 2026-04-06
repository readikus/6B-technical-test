'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { validateBookingForm, type BookingFormData, type ValidationErrors } from '../lib/validation';
import { updateAppointment } from '../lib/api';
import type { Appointment } from '../lib/types';

interface EditModalProps {
  appointment: Appointment;
  onClose: () => void;
  onSaved: (updated: Appointment) => void;
}

export default function EditModal({ appointment, onClose, onSaved }: EditModalProps) {
  const [formData, setFormData] = useState<BookingFormData>({
    name: appointment.name,
    email: appointment.email,
    phone: appointment.phone,
    description: appointment.description,
    appointmentDate: appointment.appointmentDate.slice(0, 16),
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof BookingFormData]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name as keyof BookingFormData];
        return next;
      });
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage('');

    const validationErrors = validateBookingForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      const updated = await updateAppointment(appointment.id, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        description: formData.description,
        appointmentDate: formData.appointmentDate,
      });
      onSaved(updated);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Edit Appointment
        </h2>

        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-red-800 dark:text-red-200 text-sm"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field label="Name" name="name" error={errors.name}>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              className={inputClasses(errors.name)}
            />
          </Field>

          <Field label="Email" name="email" error={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={inputClasses(errors.email)}
            />
          </Field>

          <Field label="Phone" name="phone" error={errors.phone}>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className={inputClasses(errors.phone)}
            />
          </Field>

          <Field label="Appointment Date & Time" name="appointmentDate" error={errors.appointmentDate}>
            <input
              id="appointmentDate"
              name="appointmentDate"
              type="datetime-local"
              value={formData.appointmentDate}
              onChange={handleChange}
              className={inputClasses(errors.appointmentDate)}
            />
          </Field>

          <Field label="Description" name="description" error={errors.description}>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className={inputClasses(errors.description)}
            />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function inputClasses(error?: string): string {
  const base =
    'block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100';
  return error
    ? `${base} border-red-300 dark:border-red-600`
    : `${base} border-zinc-300 dark:border-zinc-600`;
}
