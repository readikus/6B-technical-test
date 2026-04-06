'use client';

import { useState, type ChangeEvent, type FormEvent, type ReactElement, cloneElement } from 'react';
import { validateBookingForm, type BookingFormData, type ValidationErrors } from '../lib/validation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const initialFormData: BookingFormData = {
  name: '',
  email: '',
  phone: '',
  description: '',
  appointmentDate: '',
};

export default function BookingForm() {
  const [formData, setFormData] = useState<BookingFormData>(initialFormData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field error on change
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
    setSuccessMessage('');
    setErrorMessage('');

    const validationErrors = validateBookingForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          description: formData.description,
          appointmentDate: formData.appointmentDate,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setErrorMessage(body?.message ?? 'Failed to book appointment');
        return;
      }

      setSuccessMessage('Appointment booked successfully!');
      setFormData(initialFormData);
      setErrors({});
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-lg mx-auto space-y-5 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:p-8"
    >
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-2xl">
        Book an Appointment
      </h2>

      {successMessage && (
        <div role="status" className="rounded-md bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-4 text-green-800 dark:text-green-200 text-sm">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-red-800 dark:text-red-200 text-sm"
        >
          {errorMessage}
        </div>
      )}

      <Field label="Name" name="name" error={errors.name} required>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          value={formData.name}
          onChange={handleChange}
          className={inputClasses(errors.name)}
          placeholder="Jane Smith"
        />
      </Field>

      <Field label="Email" name="email" error={errors.email} required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          className={inputClasses(errors.email)}
          placeholder="jane@example.com"
        />
      </Field>

      <Field label="Phone" name="phone" error={errors.phone} required>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={formData.phone}
          onChange={handleChange}
          className={inputClasses(errors.phone)}
          placeholder="07700 900123"
        />
      </Field>

      <Field label="Appointment Date & Time" name="appointmentDate" error={errors.appointmentDate} required>
        <input
          id="appointmentDate"
          name="appointmentDate"
          type="datetime-local"
          value={formData.appointmentDate}
          onChange={handleChange}
          className={inputClasses(errors.appointmentDate)}
        />
      </Field>

      <Field label="Description" name="description" error={errors.description} required>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleChange}
          className={inputClasses(errors.description)}
          placeholder="Reason for your appointment"
        />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Submitting...' : 'Book Appointment'}
      </button>
    </form>
  );
}

/**
 * Accessible field wrapper. Injects aria-describedby, aria-invalid,
 * and aria-required into its child input/textarea via cloneElement.
 */
function Field({
  label,
  name,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  children: ReactElement<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>>;
}) {
  const errorId = `${name}-error`;

  const ariaProps: Record<string, string | boolean | undefined> = {};
  if (error) {
    ariaProps['aria-describedby'] = errorId;
    ariaProps['aria-invalid'] = true;
  }
  if (required) {
    ariaProps['aria-required'] = true;
  }

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label}
      </label>
      {cloneElement(children, ariaProps)}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function inputClasses(error?: string): string {
  const base =
    'block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100';
  return error
    ? `${base} border-red-300 dark:border-red-600`
    : `${base} border-zinc-300 dark:border-zinc-600`;
}
