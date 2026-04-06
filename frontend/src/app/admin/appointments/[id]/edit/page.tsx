'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { editBookingSchema, type EditBookingFormData } from '@/lib/schemas';
import { getAppointment, updateAppointment } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputCls(error?: object): string {
  const base =
    'block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
  return error
    ? `${base} border-red-300`
    : `${base} border-zinc-300`;
}

export default function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { token, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditBookingFormData>({
    resolver: zodResolver(editBookingSchema),
    mode: 'onTouched',
  });

  useEffect(() => {
    if (!token) return;
    getAppointment(token, id)
      .then((apt) => {
        reset({
          name: apt.name,
          email: apt.email,
          phone: apt.phone,
          date_time: toDatetimeLocal(apt.date_time),
          description: apt.description,
        });
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.message === 'Unauthorized') {
          logout();
          return;
        }
        setSubmitError(
          err instanceof Error ? err.message : 'Failed to load appointment.',
        );
        setLoading(false);
      });
  }, [token, id, reset, logout]);

  const onSubmit = async (data: EditBookingFormData) => {
    if (!token) return;
    setSubmitError(null);
    try {
      await updateAppointment(token, id, {
        ...data,
        date_time: new Date(data.date_time).toISOString(),
      });
      router.push('/admin');
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        logout();
        return;
      }
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save changes.',
      );
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-gray-500">Loading appointment...</p>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">
        Edit Appointment
      </h1>
      <p className="mb-8 text-gray-500">
        Update the appointment details below.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-label="Edit appointment"
        className="space-y-5"
      >
        {submitError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {submitError}
          </div>
        )}

        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
            Full name <span className="text-red-500">*</span>
          </label>
          <input {...register('name')} id="name" type="text" className={inputCls(errors.name)} />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Email address <span className="text-red-500">*</span>
          </label>
          <input {...register('email')} id="email" type="email" className={inputCls(errors.email)} />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
            Phone number <span className="text-red-500">*</span>
          </label>
          <input {...register('phone')} id="phone" type="tel" className={inputCls(errors.phone)} />
          {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
        </div>

        <div>
          <label htmlFor="date_time" className="mb-1 block text-sm font-medium text-gray-700">
            Date and time <span className="text-red-500">*</span>
          </label>
          <input {...register('date_time')} id="date_time" type="datetime-local" className={inputCls(errors.date_time)} />
          {errors.date_time && <p className="mt-1 text-sm text-red-600">{errors.date_time.message}</p>}
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea {...register('description')} id="description" rows={3} className={inputCls(errors.description)} />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
          <Link
            href="/admin"
            className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
