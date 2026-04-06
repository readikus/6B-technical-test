'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingSchema, type BookingFormData } from '../lib/schemas';
import { createAppointment } from '../lib/api';

export default function BookingForm() {
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    mode: 'onTouched',
  });

  async function onSubmit(data: BookingFormData) {
    setApiError('');
    setSuccess(false);

    try {
      await createAppointment(data);
      setSuccess(true);
      reset();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Book an appointment"
      className="w-full max-w-lg mx-auto space-y-5 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:p-8"
    >
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-2xl">
        Book an Appointment
      </h2>

      {success && (
        <div role="status" className="rounded-md bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-4 text-green-800 dark:text-green-200 text-sm">
          Appointment booked successfully!
        </div>
      )}

      {apiError && (
        <div role="alert" className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-red-800 dark:text-red-200 text-sm">
          {apiError}
        </div>
      )}

      <Field label="Full name" name="name" error={errors.name?.message}>
        {(a11y) => (
          <input
            {...register('name')}
            {...a11y}
            type="text"
            className={inputCls(errors.name)}
            placeholder="Jane Smith"
          />
        )}
      </Field>

      <Field label="Email address" name="email" error={errors.email?.message}>
        {(a11y) => (
          <input
            {...register('email')}
            {...a11y}
            type="email"
            className={inputCls(errors.email)}
            placeholder="jane@example.com"
          />
        )}
      </Field>

      <Field label="Phone number" name="contactNumber" error={errors.phone?.message}>
        {(a11y) => (
          <input
            {...register('phone')}
            {...a11y}
            type="tel"
            className={inputCls(errors.phone)}
            placeholder="07700 900123"
          />
        )}
      </Field>

      <Field label="Preferred date and time" name="appointmentDate" error={errors.date_time?.message}>
        {(a11y) => (
          <input
            {...register('date_time')}
            {...a11y}
            type="datetime-local"
            className={inputCls(errors.date_time)}
          />
        )}
      </Field>

      <Field label="Reason for appointment" name="description" error={errors.description?.message}>
        {(a11y) => (
          <textarea
            {...register('description')}
            {...a11y}
            rows={3}
            className={inputCls(errors.description)}
            placeholder="Describe why you need an appointment"
          />
        )}
      </Field>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Submitting…' : 'Book appointment'}
      </button>
    </form>
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
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode;
}) {
  const fieldId = `field-${name}`;
  const errorId = `${fieldId}-error`;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label} <span className="text-red-500" aria-hidden="true">*</span>
      </label>
      {children({
        id: fieldId,
        ...(error ? { 'aria-describedby': errorId, 'aria-invalid': true } : {}),
      })}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function inputCls(error?: object): string {
  const base =
    'block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100';
  return error
    ? `${base} border-red-300 dark:border-red-600`
    : `${base} border-zinc-300 dark:border-zinc-600`;
}
